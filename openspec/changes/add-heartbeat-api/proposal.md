# Proposal

Implements GitHub issue #10 ("Heartbeat API: receive usage from devices").

## Why

The extension sends per-domain seconds every minute (architecture flow 3) and learns from the response whether its block rules changed (flow 4). Nothing receives these heartbeats yet, so no usage reaches the dashboard, focus score or offline alerts.

## What Changes

- `POST /api/device/heartbeat` (`apps/web/src/app/api/device/heartbeat/route.ts`): a thin route over a tested handler in `apps/web/src/lib/device/heartbeat.ts`.
- Bearer device token, hashed with SHA-256 (`apps/web/src/lib/device/token.ts`, reusable by the pair route). Missing, malformed, unknown or revoked (device deleted by the parent) token → `401`.
- Envelope (`entries` array, `browser`, `extensionVersion`, `currentDomain`) validated with a new `HeartbeatEnvelope` schema in `@fg/shared`; invalid JSON or envelope → `400`. Each entry is then validated separately with `UsageEntry`; invalid entries are skipped, not fatal.
- Valid entries are upserted into `usage_minutes` on `(device_id, minute_utc, domain)`, replacing `seconds`, so a resend never adds. Entries that fail `UsageEntry`, are older than 7 days, more than 5 minutes ahead of the server minute, not on a whole minute, or have a domain the database would reject are skipped, the rest are stored.
- `devices.last_seen_at`, `browser` and the new `extension_version` column are updated on every authenticated, valid heartbeat.
- Response `200` with `HeartbeatResponse` `{ rulesVersion }`: the child's `children.rules_version`.
- New migration: `devices.extension_version`, `children.rules_version` (writable only by triggers, not by parents), and triggers that bump `rules_version` when the child's block rules or the family's domain category overrides change. Trigger functions are not executable by API roles.
- Service-role Supabase client `apps/web/src/lib/supabase/admin.ts` (server only, imports `server-only`).
- `packages/shared`: add `HeartbeatEnvelope` (looser request schema); `HeartbeatRequest` and `UsageEntry` stay unchanged.

## Capabilities

### New Capabilities

- `device-heartbeat`: authenticating devices, storing usage idempotently, device status, rules version.

### Modified Capabilities

None (`database-schema` is not archived yet; the new columns and triggers are specified in `device-heartbeat`).

## Impact

- New route, `lib/device/*`, `lib/supabase/admin.ts`, one new migration, tests in `apps/web/src/lib/device/` and `supabase/tests/`.
- New env var `SUPABASE_SERVICE_ROLE_KEY` (server only; set by the human in Vercel).
- No new dependency (`server-only` ships with Next.js). `packages/shared` gains one schema; existing contracts are unchanged.
- Privacy (ADR 0005, amended 2026-11-17 to allow the extension version, max 32 characters): only registrable domain, minute, seconds, browser and extension version are stored. `currentDomain` is validated but not stored.
- Builds on `supabase/migrations/20261117000000_initial_schema.sql` (PR #38). Build only after #38 is merged.
- Shares `lib/device/token.ts` and `lib/supabase/admin.ts` with change #9 (PR #36); see design.md decision 8.

## Out of scope

- Pair route and token issuing; rules endpoint (`/api/device/rules`).
- Rate limiting the device API.
- Storing or showing `currentDomain` ("now on" view).
- Soft revoke (`revoked_at`); revoking means deleting the device.
- Extension side: sending heartbeats, offline queue, reacting to `rulesVersion`.
- Updating `devices.os` (not in the request).
- Reporting skipped entries back to the extension.
