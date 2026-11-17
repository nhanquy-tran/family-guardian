# Design

## Context

Change `add-database-schema` (#7) creates `block_rules(id, child_id, kind 'domain'|'category', value, created_at, unique(child_id, kind, value))`, `block_events(id, device_id, at, domain)` and `domain_categories(family_id null = global, domain, category)`, with RLS per family; parents may read and write `block_rules` and update `children`. It has no rules version (out of scope there). Change `add-domain-categories` (#5) adds `CATEGORIES`, `SEED_CATEGORIES` and `categorize(domain, overrides?)` to `@fg/shared`. `HeartbeatResponse.rulesVersion` already exists in `packages/shared/src/contracts.ts`. The heartbeat route and device-token auth come from #10; the child overview page from #12.

As in the auth change, pages and route handlers stay thin; logic lives in `.ts` modules that take a Supabase client, so tests pass a fake. Database behaviour is tested on PGlite with the harness from #7. Requirements are in `specs/site-blocking/spec.md`.

## Goals / Non-Goals

**Goals:** the extension can always tell when its rules are stale; parents manage rules in a few clicks; blocked attempts show up the same day.

**Non-Goals:** extension enforcement (#15), override editing, allow lists (see proposal).

## Decisions

1. **Rules version in the database.** New migration `supabase/migrations/<timestamp>_site_blocking.sql` (timestamp later than the schema migration):
   - `alter table public.children add column rules_version integer not null default 0`.
   - `public.bump_rules_version()` (`security definer`, `set search_path = ''`), trigger `after insert or update or delete on public.block_rules for each row`: `update public.children set rules_version = rules_version + 1` for `new.child_id` and, if different, `old.child_id`. Row-level, so a statement touching n rows bumps n times; only "strictly increases" matters.
   - Parents must not lower the version (a device could then miss a change): `revoke update on public.children from authenticated; grant update (family_id, name, homework_categories) on public.children to authenticated`. `family_id` stays grantable so the #7 "cannot move a row" test still fails on RLS, not on privileges.
   - Alternative: compute the version as `max(created_at)` or a hash of the rules. Rejected: deletes do not move `max`, and a hash is not an integer as `HeartbeatResponse` requires.
   - `block_rules` checks: `kind = 'domain'` → `value` matches the #7 domain regex and length ≤ 253; `kind = 'category'` → `value` is one of the 9 categories.
   - `alter table public.block_events add constraint block_events_device_at_domain_key unique (device_id, at, domain)`.

2. **Domain input normalization.** `normalizeBlockDomain(input): string | null` in `apps/web/src/lib/block-rules.ts`: trim, lowercase; if the input contains `://`, take `new URL(input).hostname`; else drop anything from the first `/`, `?` or `#`; drop a `:port` and one trailing `.`; strip one leading `www.`; return the host if it matches `^[a-z0-9-]+(\.[a-z0-9-]+)+$`, is ≤ 253 chars and is not an IPv4 address, else `null`. The host is kept as typed (not reduced to the registrable domain), so `docs.google.com` does not block all of Google. Nothing but the host is stored.

3. **Rules management module** (`apps/web/src/lib/block-rules.ts`, parent's Supabase client, RLS does the family check):
   - `listBlockRules(client, childId)` → rules sorted by kind (`category` first) then value.
   - `addDomainRule(client, childId, input)`, `addCategoryRule(client, childId, category)`, `removeBlockRule(client, ruleId)`.
   - Result type `{ ok: true } | { ok: false; error: "invalid_domain" | "invalid_category" | "duplicate" | "not_found" | "failed" }`. Postgres `23505` → `duplicate`. Remove uses `.delete().eq("id", ruleId).select("id")`; zero rows → `not_found` (covers another family's rule, hidden by RLS).
   - Page `app/dashboard/children/[childId]/rules/page.tsx` (Server Component) loads the child name and rules, renders `BlockRulesView` from `src/components/block-rules-view.tsx`. Forms post to Server Actions in `actions.ts` that call the module, then `revalidatePath` and redirect back with `?error=<code>` on failure. `BlockRulesView({ childId, childName, rules, error })` is pure markup, tested with `renderToStaticMarkup`.
   - The child overview (#12) gets a "Block sites" link to this page.

4. **Expansion in shared.** `expandBlockRules(rules, overrides?)` in `packages/shared/src/block-rules.ts`: result = domain rule values ∪ `{ k ∈ keys(SEED_CATEGORIES) ∪ keys(overrides) : categorize(k, overrides) ∈ blocked categories }`, deduplicated and sorted ascending. Using `categorize` keeps precedence identical to the dashboard (override beats seed, subdomains resolve upward). Pure and synchronous.

5. **Rules endpoint.** `app/api/device/rules/route.ts` exports only `GET` and calls `handleRulesRequest(authorization, serviceClient)` in `src/lib/device/rules-endpoint.ts`, which returns `{ status, body }`:
   - Device auth: reuse the helper from #10 (if it is inline in the heartbeat route, extract it to `src/lib/device/auth.ts` first). Missing, malformed or unknown token → `401 { error: "unauthorized" }`.
   - Read `children.rules_version` and `family_id` **first**, then `block_rules` of the child and `domain_categories` where `family_id is null or family_id = <family>` (family rows overwrite global rows when building `overrides`). Reading the version before the rules means a race can only pair an old version with newer rules, which makes the extension fetch again later; the reverse could hide a change forever.
   - Body validated with `RulesResponse` before returning; header `Cache-Control: no-store`. Database error → `500 { error: "internal" }`.

6. **Blocked attempts on the heartbeat.** Shared: `BlockedAttempt = { at: z.iso.datetime(), domain: z.string().min(1).max(253) }`; `HeartbeatRequest.blocked = z.array(BlockedAttempt).max(1000).optional()` (optional, so today's extension stays valid). `recordBlockedAttempts(serviceClient, deviceId, attempts, now)` in `src/lib/device/block-events.ts` drops attempts older than 7 days, more than 5 minutes in the future, or whose domain fails the domain regex, then upserts the rest with `onConflict: "device_id,at,domain", ignoreDuplicates: true`. Empty after filtering → no query. The heartbeat route calls it after the usage upsert.

7. **Blocked today card.** `getBlockedToday(client, childId, range)` in `src/lib/blocked-today.ts` selects `domain` from `block_events` joined to `devices!inner(child_id)` with `at >= range.from and at < range.to` (the overview's "today" in the parent's timezone, from #12), and `summarizeBlocked(domains)` returns `{ count, top: { domain, count }[] }`: top 5 by count desc, then domain asc. `BlockedTodayCard({ summary })` in `src/components/blocked-today-card.tsx` renders on the child overview.

## Risks / Trade-offs

- [Dependencies #7, #5, #9, #10, #12 not merged] → The developer stops and reports instead of stubbing them.
- [Override changes do not bump the version] → No override UI exists yet; the change that adds it must bump. Listed out of scope.
- [Large rule sets vs. DNR limits (30 000 dynamic rules)] → Seed is ~150 domains; a parent would need thousands of rules. No cap in MVP.
- [Many blocked attempts make the today query large] → One row per blocked navigation; fine for 20 families. Can move to a SQL aggregate later.
- [Retried heartbeat with a re-timestamped attempt] → Counted twice; the extension (#15) must keep the original `at`.
