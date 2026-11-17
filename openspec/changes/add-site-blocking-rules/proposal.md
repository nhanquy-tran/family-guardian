# Proposal

Implements GitHub issue #14 ("Site blocking: rules management and rules API").

## Why

Parents need to block sites for each child, and the extension (issue #15) needs one endpoint that tells it which domains to block and when its copy is stale. Change #10 already added `children.rules_version`, its bump triggers on `block_rules` and `domain_categories`, and the heartbeat returns `rulesVersion`. What is missing: a way for parents to manage rules, an endpoint that expands them to domains, value checks on `block_rules`, and a place to send blocked attempts.

## What Changes

- New migration (small): value checks on `block_rules.value` and a unique key on `block_events (device_id, at, domain)`. Nothing from #10 is recreated: `rules_version`, `bump_rules_version()`, `bump_family_rules_version()`, their triggers and the `children` column grants stay as shipped in `20261117100000_heartbeat.sql`.
- Dashboard page `/dashboard/children/[childId]/rules`: list rules, block a domain, block a category, remove a rule. Reached from a "Block sites" link on `/dashboard/children` (#9).
- `GET /api/device/rules` (bearer device token): returns `{ rulesVersion, domains, truncated }`, with category rules expanded to domains using the shared seed plus global and family `domain_categories` rows. The list is capped at `MAX_RULE_DOMAINS = 5000`.
- Shared: `RulesResponse`, `BlockedAttempt`, `MAX_BLOCKED_ATTEMPTS = 1000`, `MAX_RULE_DOMAINS = 5000`, optional `blocked` on `HeartbeatRequest` and `HeartbeatEnvelope`, and `expandBlockRules()`.
- The heartbeat handler stores `blocked` attempts in `block_events`, with the same envelope-then-per-entry validation as usage entries.

## Capabilities

### New Capabilities

- `site-blocking`: value checks and per-child block rules, rules API with expansion and cap, blocked attempt ingestion.

### Modified Capabilities

None (the heartbeat change is not an archived spec yet; its `HeartbeatRequest` gains an optional field).

## Impact

- `supabase/migrations/` (new file), `supabase/tests/`, `packages/shared/src/`, `apps/web/src/lib/`, `apps/web/src/lib/device/` (extends `heartbeat.ts` and `supabase-store.ts`), `apps/web/src/app/api/device/rules/`, `apps/web/src/app/dashboard/children/`.
- Reuses `hashDeviceToken` (`src/lib/device/token.ts`) and `createAdminClient` (`src/lib/supabase/admin.ts`). No new dependencies.
- Privacy (ADR 0005): the extension sends only the blocked domain and the time of the attempt, into the existing `block_events(device_id, at, domain)` table. No new stored data, so no new ADR.
- Depends on #7 (schema), #5 (categories), #9 (children page), #10 (heartbeat, device token auth, `rules_version`), all merged. Independent of #11 and #12.
- Extension enforcement (fetching rules, declarativeNetRequest, blocked page, sending `blocked`) is #15, built after this change.

## Out of scope

- Extension side (#15), including keeping the original `at` when resending a blocked attempt.
- "Blocked today" card and any blocked-attempt summary: needs the child overview (#12), which is not built. Follow-up note for #12: show a "Blocked today" card (count and top 5 domains from `block_events` joined to `devices`) and a "Block sites" link to the rules page.
- UI to edit `domain_categories` overrides (the version bump for overrides already exists from #10).
- Allow lists, schedules, time limits, temporary unblock.
- Blocking every unknown site via category `other` (only domains mapped to `other` are blocked).
- Rate limiting the rules endpoint; a per-child cap on rule count.
- Blocked attempts history UI.
