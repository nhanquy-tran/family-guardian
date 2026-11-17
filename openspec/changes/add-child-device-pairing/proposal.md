# Proposal

Implements GitHub issue #9 ("Add a child and pair a device with a code"), including the owner requirement from the spec review of #27 (pairing code collisions).

## Why

Parents can sign in (issue #8) but cannot add a child or connect the child's browser, so no usage data can arrive. Pairing is key flow 2 in `docs/architecture.md`.

## What Changes

- **Children page** (`/dashboard/children`): list, add, rename and delete children through the parent session and RLS.
- **Pair a device**: per child, a button creates a 6-character code from a 32-character alphabet without `0 O 1 I`, valid 1 hour, shown on the page. Generating a new code deletes the child's earlier codes first.
- **Delete confirmation**: deleting a child needs a second step that names the child and says devices and usage history are deleted (no client JS).
- **Code collisions** (owner requirement): on `23505`, generate a new random code and retry up to 3 times; then show "This code is already in use" with a **Generate another code** button. A colliding parent-chosen code gets "This code is already in use, please choose another", no retry.
- **`POST /api/device/pair { code, browser, os }`**: consumes the code atomically (single use), creates a `devices` row with the SHA-256 hash of a new random token, returns the token once.
- Invalid, expired and used codes return the same `400` body.
- **Rate limit**: max 10 attempts per IP per 10 minutes (`429`), stored in Postgres so it works across Vercel instances. The IP is stored only as `HMAC-SHA256(ip, PAIR_RATE_LIMIT_SECRET)`; old rows are purged on every call and by a daily `pg_cron` job. Fails closed (`500 server_error`) if the limiter or the secret fails. Without forwarding headers, a warning is logged and the shared `unknown` bucket applies (accepted on Vercel). See `docs/decisions/0012-rate-limit-ip-hmac.md` (accepted).
- Shared zod contracts and code helpers; a migration with `pair_attempts`, a daily purge job and three service-role-only SQL functions.

## Capabilities

### New Capabilities

- `child-management`: add, rename, delete and list children.
- `device-pairing`: code creation, pair endpoint, single use, rate limit.

### Modified Capabilities

None.

## Impact

- New code in `packages/shared`, `apps/web/src/lib`, `apps/web/src/app/dashboard/children`, `apps/web/src/app/api/device/pair`; new migration tested with the PGlite harness from issue #7.
- Uses existing `SUPABASE_SERVICE_ROLE_KEY` (server code only, `admin.ts` imports `server-only`). New server-only env var `PAIR_RATE_LIMIT_SECRET` (name added to `apps/web/.env.example`). No new dependencies or services.
- Privacy: the extension sends only browser and OS name (ADR 0005). The server keeps a keyed HMAC-SHA256 of the caller IP, never the IP, for 10 minutes (up to 24 hours more if no one pairs and before the daily purge) for the rate limit; governed by ADR 0012.
- Depends on issues #7 (schema, RLS, harness) and #8 (dashboard shell, server client).

## Out of scope

- Extension options page that enters the code and stores the token.
- A UI field for parent-chosen codes (only its error handling is specified).
- Device list, rename, unpair; heartbeat and rules endpoints.
- Editing homework categories.
- Cleanup job for expired pairing codes.
- Playwright end-to-end tests.
