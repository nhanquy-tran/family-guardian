# Notes: add-heartbeat-api (#10)

## What changed

- `POST /api/device/heartbeat` (`route.ts`, only `POST` exported) over the pure `handleHeartbeat` in `lib/device/heartbeat.ts`: auth (bearer, SHA-256 hash) → envelope (`HeartbeatEnvelope`) → 413 above 1440 entries → per-entry filtering (`UsageEntry`, whole minute, 7 days back / 5 minutes ahead, domain regex) → de-duplication (last wins) → upsert → device update → counts-only log.
- `lib/device/token.ts` (`hashDeviceToken`), `lib/device/supabase-store.ts`, `lib/supabase/admin.ts` (imports `server-only` first; throws naming a missing env var).
- Migration `supabase/migrations/20261117100000_heartbeat.sql`: `devices.extension_version`, `children.rules_version` (parents lose table-level insert/update on `children`, keep column-level grants without `rules_version`), `bump_rules_version` and `bump_family_rules_version` triggers (security definer, execute revoked from API roles).
- Docs: `docs/architecture.md` data model, `docs/human-setup.md` (`SUPABASE_SERVICE_ROLE_KEY` is server only).
- `packages/shared/src/contracts.ts`: only a whitespace fix (`HeartbeatResponse =z.object`); `HeartbeatEnvelope` and `MAX_HEARTBEAT_ENTRIES` were already added with the tests.

## Verification

Each scenario is covered by the committed tests: `heartbeat.test.ts` (auth, envelope, cap, log, storage, skipping, device update, response), `token.test.ts`, `supabase-store.test.ts`, `route.test.ts`, `shared-helpers.test.ts`, `contracts.test.ts` (shared) and `supabase/tests/heartbeat.test.ts` (PGlite: upsert replace, rules_version triggers and privileges, extension_version). `npm run check` (156 tests) and `npm run build` pass. No test was edited.

## For the human to check

- Migration is applied by CI on merge (ADR 0011); `SUPABASE_SERVICE_ROLE_KEY` must be set in Vercel or the route returns a server error.
- The route uses relative imports because the vitest config has no `@/` alias.
- `findDevice` treats a device whose child join returns null as unknown (401); not possible with the current FK, defensive only.
- `npm run check` shows 5 unused-variable lint warnings in `heartbeat.test.ts` (test-writer's file, left untouched).
- The pair route (#9) must store tokens with `hashDeviceToken`.
