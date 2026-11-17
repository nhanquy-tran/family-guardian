# Tasks

## 0. Prerequisite

- [ ] 0.1 Confirm PR #38 (`supabase/migrations/20261117000000_initial_schema.sql`) is merged; do not build before

## 1. Tests first

- [ ] 1.1 Write `apps/web/src/lib/device/token.test.ts`, `apps/web/src/lib/device/heartbeat.test.ts` (fake `HeartbeatStore` recording calls, recording `log`) and `apps/web/src/lib/device/supabase-store.test.ts` (fake Supabase client recording calls) for the scenarios in `specs/device-heartbeat/spec.md`
- [ ] 1.2 Write `packages/shared/src/contracts.test.ts` cases for `HeartbeatEnvelope` and `MAX_HEARTBEAT_ENTRIES`, and `apps/web/src/app/api/device/heartbeat/route.test.ts`
- [ ] 1.3 Write `supabase/tests/heartbeat.test.ts` using the PGlite harness (`supabase/tests/harness.ts`) for the migration scenarios; verify all new tests fail only because the code and migration do not exist yet

## 2. Implementation

- [ ] 2.1 Add `HeartbeatEnvelope` to `packages/shared/src/contracts.ts` (`MAX_HEARTBEAT_ENTRIES` is already exported there by this spec PR; keep `HeartbeatRequest` and `UsageEntry`); verify the shared tests pass
- [ ] 2.2 Add `supabase/migrations/<timestamp>_heartbeat.sql` (design.md decision 7)
- [ ] 2.3 Run the new migration in the PGlite harness and verify `supabase/tests/heartbeat.test.ts` passes before wiring the route
- [ ] 2.4 Add `lib/device/token.ts` (`hashDeviceToken`) and `lib/device/heartbeat.ts` (`handleHeartbeat`, decisions 1 to 5); verify token and handler tests pass
- [ ] 2.5 Add `lib/supabase/admin.ts` (imports `server-only`; skip creating `admin.ts` or `token.ts` if change #9 already did) and `lib/device/supabase-store.ts` (decision 6); verify store tests pass
- [ ] 2.6 Add `app/api/device/heartbeat/route.ts` exporting only `POST`, wiring request, `new Date()`, the store and the count logger to the handler
- [ ] 2.7 Document `SUPABASE_SERVICE_ROLE_KEY` (name only, server only) in `docs/human-setup.md` under Vercel, and add `extension_version` and `rules_version` to the data model in `docs/architecture.md`

## 3. Verify

- [ ] 3.1 Run `npm run check` and `npm run build` and fix all failures without weakening tests
