# Design

## Context

`docs/architecture.md` defines the MVP data model and security model: parents use the Supabase session (RLS per family), devices call server routes that use the service-role key. Google is the only sign-in (ADR 0004), so a new `auth.users` row means a first sign-in. Only registrable domains and seconds are stored (ADR 0005). Requirements are in `specs/database-schema/spec.md`.

## Goals / Non-Goals

**Goals:** one migration that applies cleanly on Supabase; RLS that is tested, not just written; the database rejects obviously non-domain values.

**Non-Goals:** seed data, cron jobs, API routes (see proposal, Out of scope).

## Decisions

1. **One migration file** `supabase/migrations/20261117000000_initial_schema.sql`, plain SQL, no extensions (`gen_random_uuid()` is built in). Supabase CLI naming (`<timestamp>_<name>.sql`) so `supabase db push` works.

2. **Tables** (all in `public`, `uuid` ids default `gen_random_uuid()`, `created_at timestamptz not null default now()` where the model has it; foreign keys `on delete cascade` down the tree auth user → parent, family → children → devices → device data):
   - `families(id, name text not null, created_at)`
   - `parents(user_id uuid pk references auth.users, family_id not null references families, created_at)`: one family per parent.
   - `children(id, family_id, name text not null check (char_length between 1 and 50), homework_categories text[] not null default '{}', created_at)`; check that `homework_categories <@` the 9 categories of the `domain-categories` capability.
   - `devices(id, child_id, token_hash text not null unique, browser text not null check in ('chrome','edge','brave','other'), os text not null check (char_length <= 32), last_seen_at timestamptz, created_at)`. Browser values match `HeartbeatRequest.browser`.
   - `pairing_codes(code text pk check (code ~ '^[A-Z0-9]{6}$'), child_id, expires_at timestamptz not null)`.
   - `usage_minutes(device_id, minute_utc timestamptz, domain text, seconds int check (1..60), pk(device_id, minute_utc, domain))`; check `minute_utc = date_trunc('minute', minute_utc)`.
   - `block_rules(id, child_id, kind text check in ('domain','category'), value text not null, created_at, unique(child_id, kind, value))`.
   - `domain_categories(id, family_id uuid null references families, domain, category, unique nulls not distinct (family_id, domain))`. `family_id null` = global seed row; non-null = family override.
   - `block_events(id bigint generated always as identity pk, device_id, at timestamptz not null default now(), domain)`.
   - `alerts(id, device_id, kind text check in ('offline'), sent_at timestamptz not null default now())`.
   - Every `domain` column: `check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' and char_length(domain) <= 253)`. This rejects URLs, paths, spaces and upper case (ADR 0005 defence in depth). `domain_categories.category` uses the same 9-value check.
   - Indexes on the foreign keys used by RLS and the dashboard: `children(family_id)`, `devices(child_id)`, `pairing_codes(child_id)`, `block_rules(child_id)`, `block_events(device_id, at)`, `alerts(device_id)`.

3. **Family lookup helper.** `public.current_family_id()` returns the `family_id` of `auth.uid()`; `security definer`, `stable`, `set search_path = ''`. Policies call it instead of joining `parents` directly, which avoids RLS recursion on `parents`. Child-scoped tables check `child_id in (select id from public.children where family_id = public.current_family_id())`; device-scoped tables go through `devices` the same way.

4. **Policies** (role `authenticated` only; no policy for `anon`, so it sees nothing; `service_role` has `bypassrls` in Supabase):
   | Table | Parent may |
   |---|---|
   | families | select, update own |
   | parents | select rows of own family |
   | children, block_rules, pairing_codes | select, insert, update, delete in own family |
   | devices | select, delete in own family |
   | usage_minutes, block_events, alerts | select in own family |
   | domain_categories | select global + own; insert, update, delete own (`family_id = current_family_id()`) |
   `with check` mirrors `using` on every write policy, so a parent cannot move a row into another family.
   Column privilege: `revoke select on devices from authenticated, anon` then `grant select (id, child_id, browser, os, last_seen_at, created_at) on devices to authenticated`, so `token_hash` stays server-only.

5. **First sign-in trigger.** `public.handle_new_user()` (`security definer`, `set search_path = ''`) runs `after insert on auth.users`: if no `parents` row exists for `new.id`, insert a family named `coalesce(new.raw_user_meta_data->>'full_name', 'My family')` and the parent row. Alternative: create the family from the dashboard on first load; rejected because it needs extra app code and a race-free insert policy on `families`.

6. **Testing with PGlite.** Tests must run in `npm run check` and CI without Docker. `@electric-sql/pglite` (Postgres compiled to WASM, dev dependency only) runs real Postgres in-process, so RLS, triggers and constraints are exercised for real. Alternative: Supabase CLI + pgTAP; rejected because it needs Docker in CI and a second test runner. The test helper (`supabase/tests/harness.ts`) prepares a minimal Supabase stand-in before applying every file in `supabase/migrations/` in name order:
   - roles `anon`, `authenticated` (nologin) and `service_role` (nologin, bypassrls); `grant usage on schema public` and `alter default privileges in schema public grant all on tables to anon, authenticated, service_role` (as Supabase does);
   - `auth.users(id uuid pk, email text, raw_user_meta_data jsonb)` and `auth.uid()` reading `current_setting('request.jwt.claim.sub', true)`;
   - helpers `asParent(userId, fn)`, `asAnon(fn)`, `asService(fn)` that run `fn` in a transaction after `set local role ...` and `set local request.jwt.claim.sub = ...`.
   The stand-in lives only in tests; the migration never creates `auth` objects.

7. **Pairing code uniqueness.** `pairing_codes.code` stays the primary key, so the database itself enforces uniqueness across all families (the check runs below RLS, so parent B gets `23505` without ever reading family A's row). Parents keep direct insert (decision 4). To stop expired codes blocking a value forever, a `before insert or update of code` trigger on `pairing_codes` runs `public.purge_expired_pairing_code()` (`security definer`, `set search_path = ''`): `delete from public.pairing_codes where code = new.code and expires_at < now()`. Then the primary key decides: an expired row is gone, so the insert succeeds; an active row stays, so the insert fails with `23505`.
   - Alternative: a `create_pairing_code(child_id, code)` security-definer function; rejected because parents would need a second way to write the table, the function must re-implement the family check that RLS already does, and the dashboard would call `rpc` instead of a plain insert.
   - Alternative: a partial unique index on active codes; rejected because `now()` is not allowed in an index predicate.
   - The trigger deletes only a row with the exact same `code` and only if it is expired, so it exposes nothing and cannot remove a live code. Expired rows with other values are left for the (out of scope) cleanup job.
   - Leak surface: the only signal to a parent is success or `23505` for a value they chose. The error detail repeats their own value, nothing else.

## Risks / Trade-offs

- [PGlite behaviour differs from hosted Supabase] → Both are stock Postgres; the stand-in copies Supabase's default grants. The human applies the migration to the hosted project and checks the Supabase security advisor.
- [`nulls not distinct` needs Postgres 15+] → Supabase and PGlite both run 15+.
- [Category list duplicated in SQL and `packages/shared` (change `add-domain-categories`, not merged yet)] → The tests assert the 9 values listed in the spec; a later change can compare them to `CATEGORIES` directly.
- [Pairing code guessing via primary key conflict: a parent can probe whether a specific code is taken, and a code is a bearer credential for pairing a device to that child] → The probe only says "taken", never whose or for which child. The space is 32^6 ≈ 1.07 billion values (6 characters from a 32-character alphabet, which the generator in issue #9 must use), codes live 1 hour, and the pair route will be rate limited. Probing also needs a signed-in parent account, and even a hit does not pair anything without the pair route. Acceptable for MVP; the rate limit belongs to the pair route change, not this one.
- [Trigger deletes an expired row even if the insert then fails] → Harmless: the row was expired and unusable.
- [`code ~ '^[A-Z0-9]{6}$'` allows 36 characters, wider than the 32-character alphabet] → The database stays permissive; the generator picks the alphabet.
