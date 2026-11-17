# Proposal

Implements GitHub issue #14 ("Site blocking: rules management and rules API").

## Why

Parents need to block sites for each child, and the extension (issue #15) needs one endpoint that tells it which domains to block and when its copy is stale. The heartbeat already returns a `rulesVersion`, but nothing stores or bumps it, and blocked attempts have nowhere to go.

## What Changes

- New migration: `children.rules_version` (bumped by a trigger on every `block_rules` insert, update or delete; parents cannot write it), value checks on `block_rules.value`, and a unique key on `block_events (device_id, at, domain)` so heartbeat retries do not double count.
- Dashboard page `/dashboard/children/[childId]/rules`: list rules, block a domain, block a category, remove a rule.
- `GET /api/device/rules` (bearer device token): returns `{ rulesVersion, domains }`, with category rules expanded to domains using the shared seed plus global and family `domain_categories` rows.
- Shared: `RulesResponse` and `BlockedAttempt` zod contracts, optional `blocked` array on `HeartbeatRequest`, and `expandBlockRules()`.
- The heartbeat route stores `blocked` attempts in `block_events`.
- Child overview shows a "Blocked today" card: attempt count and top 5 blocked domains.

## Capabilities

### New Capabilities

- `site-blocking`: block rules per child, rules version, rules API, blocked attempt ingestion and the blocked-today summary.

### Modified Capabilities

None (heartbeat and schema changes are not archived specs yet).

## Impact

- `supabase/migrations/` (new file), `supabase/tests/`, `packages/shared/src/`, `apps/web/src/lib/`, `apps/web/src/app/api/device/rules/`, `apps/web/src/app/api/device/heartbeat/`, `apps/web/src/app/dashboard/children/[childId]/rules/`.
- No new dependencies. Privacy unchanged: the extension sends only domain and time of a blocked attempt (ADR 0005).
- Depends on #7 (schema), #5 (categories), the auth shell, #9 (children), #10 (heartbeat + device auth) and #12 (child overview) being merged first.

## Out of scope

- Extension side: fetching rules, declarativeNetRequest, the blocked page, sending `blocked` (issue #15).
- UI to edit `domain_categories` overrides; bumping the rules version when overrides change.
- Allow lists, schedules, time limits, temporary unblock.
- Blocking every unknown site via category `other` (only domains mapped to `other` are blocked).
- Rate limiting the rules endpoint; a per-child cap on rule count.
- Blocked attempts history beyond today.
