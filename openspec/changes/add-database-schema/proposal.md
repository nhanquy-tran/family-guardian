# Proposal

Implements GitHub issue #7 ("Database schema and RLS policies").

## Why

Pairing, heartbeat, rules, the dashboard and offline alerts all need tables in Supabase. Nothing exists yet: there is no `supabase/` folder. Every later backend issue depends on this first migration, and the security rule in `CLAUDE.md` (RLS limited to the parent's family on every table) has to hold from day one.

## What Changes

- New migration `supabase/migrations/20261117000000_initial_schema.sql` creating the 10 tables of the architecture data model: `families`, `parents`, `children`, `devices`, `pairing_codes`, `usage_minutes`, `block_rules`, `domain_categories`, `block_events`, `alerts`.
- `usage_minutes` primary key `(device_id, minute_utc, domain)` so heartbeat retries upsert instead of duplicating.
- Check constraints that back ADR 0005 at the database level: `domain` columns accept only a bare lowercase hostname (no scheme, path or query), `seconds` is 1..60.
- RLS enabled on every table. A signed-in parent reads and writes only rows of their own family. Device data (`devices` inserts and updates, `usage_minutes`, `block_events`, `alerts`) is written only by the service role used in server routes. `anon` sees nothing. Parents cannot read `devices.token_hash`.
- Pairing codes are unique across all families while active: the primary key enforces it, and a trigger removes an expired row with the same value before insert. Parents insert codes directly for their own children.
- A trigger on `auth.users` insert (first Google sign-in) creates a family and the parent row.
- `supabase/README.md`: how to apply migrations and run the schema tests.
- Schema tests in `supabase/tests/schema.test.ts`, run by `npm run check` on an in-process Postgres (PGlite, new dev dependency, see design.md).

## Capabilities

### New Capabilities

- `database-schema`: tables, keys, constraints, RLS policies and the first-sign-in trigger.

### Modified Capabilities

None.

## Impact

- New `supabase/` folder (migration, README, tests).
- `vitest.config.ts` includes `supabase/tests/**/*.test.ts`.
- Root dev dependency `@electric-sql/pglite`.
- No app code changes; no consumer uses the tables yet.

## Out of scope

- Seeding `domain_categories` with the shared seed list.
- `pg_cron` jobs: offline detection (ADR 0010) and 13-month usage retention.
- A rules version column or function for the heartbeat response.
- Pairing, heartbeat and rules API routes; dashboard pages; Supabase client setup in `apps/web`.
- Inviting a second parent into an existing family.
- Rate limiting and generating pairing codes.
- Dashboard behaviour when a pairing code is already in use: belongs to issue #9 (pairing UI). It should generate a new random code and retry automatically on `23505`, and show a message only if the retries fail. This change only guarantees the database rejects the duplicate.
- Applying the migration to the hosted project (human step, documented in the README).
