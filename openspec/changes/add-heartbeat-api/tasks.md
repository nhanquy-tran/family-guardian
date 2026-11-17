# Tasks

## 1. Tests first

- [ ] 1.1 Write `apps/web/src/lib/device/token.test.ts`, `apps/web/src/lib/device/heartbeat.test.ts` (with a fake `HeartbeatStore` recording calls) and `apps/web/src/lib/device/supabase-store.test.ts` (with a fake Supabase client recording calls) for the scenarios in `specs/device-heartbeat/spec.md`
- [ ] 1.2 Write `supabase/tests/heartbeat.test.ts` using the PGlite harness from `add-database-schema` for the migration scenarios; verify all new tests fail only because the code and migration do not exist yet

## 2. Implementation

- [ ] 2.1 Add `supabase/migrations/<timestamp>_heartbeat.sql` (design.md decision 7); verify the migration tests pass
- [ ] 2.2 Add `lib/device/token.ts` (`hashDeviceToken`) and `lib/device/heartbeat.ts` (`handleHeartbeat`, decisions 1 to 5); verify token and handler tests pass
- [ ] 2.3 Add `lib/supabase/admin.ts` and `lib/device/supabase-store.ts` (decision 6); verify store tests pass
- [ ] 2.4 Add `app/api/device/heartbeat/route.ts` exporting only `POST`, wiring request, `new Date()` and the store to the handler
- [ ] 2.5 Document `SUPABASE_SERVICE_ROLE_KEY` (name only, server only) in `docs/human-setup.md` under Vercel, and add `extension_version` and `rules_version` to the data model in `docs/architecture.md`

## 3. Verify

- [ ] 3.1 Run `npm run check` and `npm run build` and fix all failures without weakening tests
