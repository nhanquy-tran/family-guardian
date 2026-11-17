# Design

## Context

Already on main:
- #7: `block_rules(id, child_id, kind 'domain'|'category', value, created_at, unique(child_id, kind, value))`, `block_events(id, device_id, at, domain)`, `domain_categories(family_id null = global, domain, category)`, RLS per family.
- #5: `CATEGORIES`, `SEED_CATEGORIES`, `categorize(domain, overrides?)` in `@fg/shared`.
- #10 (`supabase/migrations/20261117100000_heartbeat.sql`): `children.rules_version`, `bump_rules_version()` and `bump_family_rules_version()` with their triggers on `block_rules` and `domain_categories`, and the `children` column grants (parents cannot write `rules_version`). The heartbeat handler in `src/lib/device/heartbeat.ts` validates an envelope (`HeartbeatEnvelope`), then each entry separately, skipping bad entries, with `413 too_many_entries` above `MAX_HEARTBEAT_ENTRIES`; it talks to a `HeartbeatStore` implemented in `supabase-store.ts`.

This change references those objects and does not recreate them. Logic lives in `.ts` modules that take a store or Supabase client, so tests pass a fake. Database behaviour is tested on PGlite with the harness from #7. Requirements are in `specs/site-blocking/spec.md`.

## Goals / Non-Goals

**Goals:** parents manage rules in a few clicks; the extension gets one capped, versioned domain list; blocked attempts are stored once.

**Non-Goals:** extension enforcement (#15), blocked-today card (#12), override editing, allow lists (see proposal).

## Decisions

1. **Migration `supabase/migrations/<timestamp>_site_blocking.sql`** (timestamp later than `20261117100000`), only:
   - `block_rules` check: `kind = 'domain'` → `value` matches `^[a-z0-9-]+(\.[a-z0-9-]+)+$` and length ≤ 253; `kind = 'category'` → `value` is one of the 9 categories. Existing rows: none are written today (no UI), so the checks apply without a backfill.
   - `alter table public.block_events add constraint block_events_device_at_domain_key unique (device_id, at, domain)`.
   - Rules version, triggers and grants are not touched. Note for later migrations (from #10's column-level grant): a new parent-editable `children` column must also be granted; add a line to `docs/architecture.md` (task 5.1).

2. **Domain input normalization.** `normalizeBlockDomain(input): string | null` in `apps/web/src/lib/block-rules.ts`: trim, lowercase; if the input contains `://`, take `new URL(input).hostname` (catch errors → `null`); else drop anything from the first `/`, `?` or `#`; drop a `:port` and one trailing `.`; strip one leading `www.`; return the host if it matches the domain regex, is ≤ 253 chars and is not an IPv4 address, else `null`. The host is kept as typed (not reduced to the registrable domain), so blocking `docs.google.com` does not block all of Google. Nothing but the host is stored.

3. **Rules management module** (`apps/web/src/lib/block-rules.ts`, parent's Supabase client, RLS does the family check):
   - `listBlockRules(client, childId)` → rules sorted by kind (`category` first) then value.
   - `addDomainRule(client, childId, input)`, `addCategoryRule(client, childId, category)`, `removeBlockRule(client, ruleId)`.
   - Result type `{ ok: true } | { ok: false; error: "invalid_domain" | "invalid_category" | "duplicate" | "not_found" | "failed" }`. Postgres `23505` → `duplicate`; any other store error → `failed` (never thrown to the page). Remove uses `.delete().eq("id", ruleId).select("id")`; zero rows → `not_found` (covers another family's rule, hidden by RLS).
   - Page `app/dashboard/children/[childId]/rules/page.tsx` (Server Component) loads the child name and rules, renders `BlockRulesView` from `src/components/block-rules-view.tsx`. If listing fails, the page shows the `failed` message instead of an empty list. Server Actions in `actions.ts` call the module, then `revalidatePath` and redirect back with `?error=<code>` on failure. `BlockRulesView({ childId, childName, rules, error })` is pure markup, tested with `renderToStaticMarkup`. The Server Action wiring (redirect, revalidate) is thin and verified manually in the PR; the logic it calls is tested.
   - Removing a rule is one click without confirmation: it deletes only the rule (re-adding is one click), not any history.
   - `/dashboard/children` gets a "Block sites" link per child.

4. **Expansion in shared.** `expandBlockRules(rules, overrides?)` in `packages/shared/src/block-rules.ts`: result = domain rule values ∪ `{ k ∈ keys(SEED_CATEGORIES) ∪ keys(overrides) : categorize(k, overrides) ∈ blocked categories }`, deduplicated and sorted ascending. Using `categorize` keeps precedence identical to the dashboard (override beats seed, subdomains resolve upward). Pure and synchronous. No cap here.

5. **Rules endpoint.** `app/api/device/rules/route.ts` exports only `GET` and calls `handleRules({ authorization, store })` in `src/lib/device/rules-endpoint.ts`, which returns `{ status, body, headers }`. Same pattern as the heartbeat: a `RulesStore` interface implemented over the admin client in `supabase-store.ts` (built with `createAdminClient`).
   - Auth: `Authorization: Bearer <token>`; `hashDeviceToken(token)` (`src/lib/device/token.ts`) → `store.findChild(tokenHash)` returning `{ childId, familyId, rulesVersion } | null`. Missing, malformed or unknown token → `401 { error: "unauthorized" }`, no rules query.
   - Order: `findChild` (reads `rules_version` and `family_id`) **first**, then `listRules(childId)`, then `listCategoryOverrides(familyId)` (`domain_categories` where `family_id is null or family_id = <family>`; family rows overwrite global rows when building `overrides`). Reading the version before the rules means a race can only pair an old version with newer rules, so the extension fetches again later; the reverse could hide a change forever.
   - Every store call can fail: any thrown error → `500 { error: "server_error" }` with no partial body. The extension keeps its last good rules (fail closed here means: never send a partial or empty list as if it were valid).
   - **Cap:** `MAX_RULE_DOMAINS = 5000` in `@fg/shared`. The explicit `domain` rules come first (sorted), then category-expanded domains (sorted) until the cap; `truncated: true` if anything was cut, else `false`. Explicit parent choices therefore survive truncation. The seed is about 150 domains, so truncation only happens for abnormal data; the cap bounds the response and Chrome's 30 000 dynamic-rule limit. PostgREST's default 1000-row limit applies to each query; the `block_rules` and overrides queries use `.limit(MAX_RULE_DOMAINS)`.
   - Body validated with `RulesResponse` (`{ rulesVersion, domains: string[] (max 5000), truncated: boolean }`) before returning; header `Cache-Control: no-store`.

6. **Blocked attempts on the heartbeat** (same shape as usage entries):
   - Shared: `BlockedAttempt = { at: z.iso.datetime(), domain: z.string().min(1).max(253) }`; `MAX_BLOCKED_ATTEMPTS = 1000`. `HeartbeatEnvelope.blocked = z.array(z.unknown()).optional()` and `HeartbeatRequest.blocked = z.array(BlockedAttempt).max(MAX_BLOCKED_ATTEMPTS).optional()` (optional, so today's extension stays valid).
   - Handler (`heartbeat.ts`): after the envelope parses, `blocked.length > MAX_BLOCKED_ATTEMPTS` → `413 { error: "too_many_entries" }`, nothing written (same check point and code as usage). Each raw attempt is validated separately with `BlockedAttempt.safeParse`, then kept only if `at` is within the same window as usage (not older than 7 days, not more than 5 minutes in the future) and `domain` matches the domain regex; otherwise skipped and counted in `skipped`. Kept attempts are deduplicated on `(at, domain)` and `at` is normalized with `toISOString()`.
   - `HeartbeatStore` gets `insertBlocked(rows: { device_id; at; domain }[])`, implemented as `insert(rows, { onConflict: "device_id,at,domain", ignoreDuplicates: true })` (`on conflict do nothing`). Empty after filtering → no call. The handler calls it after `upsertUsage` and before `updateDevice`. A store error → `500 server_error` like the other store calls; a retry is safe because inserts are idempotent.
   - The `at` timestamp is within ADR 0005 (blocked domain plus time); nothing else is accepted per attempt (extra fields such as `url` are stripped by zod).
   - Retention: `block_events` follows the same 13-month retention as usage (documented in `docs/architecture.md`, task 5.1; the cron job is not part of this change).

## Risks / Trade-offs

- [Extension is #15] This change adds no enforcement; until #15 ships, rules are stored and served but not applied.
- [Truncation at 5000] Silent for a parent; `truncated` lets the extension or a later UI surface it.
- [Retried heartbeat with a re-timestamped attempt] Counted twice; the extension (#15) must keep the original `at`.
- [Host-only rules] Blocking `docs.google.com` does not block `google.com`; a parent wanting both adds both. Confirmed as the intended MVP behaviour by the reviewer's human check.
- [Preview deployments use the production database] Migration-dependent behaviour (the new unique key, value checks) is tested on production right after merge (the migration job runs first), per `docs/factory-learnings.md`; the gate comment should say so.
