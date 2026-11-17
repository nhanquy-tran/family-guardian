# Tasks

## 1. Tests first

- [ ] 1.1 Write `packages/shared/src/pairing.test.ts`, `apps/web/src/lib/children.test.ts`, `apps/web/src/lib/pairing/create-code.test.ts`, `apps/web/src/lib/pairing/pair-device.test.ts` and `apps/web/src/components/children-list.test.ts` with one test per scenario in `specs/child-management/spec.md` and `specs/device-pairing/spec.md`, using fake Supabase clients, stub deps and `renderToStaticMarkup`; verify they fail only because the modules do not exist yet
- [ ] 1.2 Write `supabase/tests/pairing.test.ts` for the database scenarios on the PGlite harness from issue #7 (it must be picked up by the root `vitest.config.ts` include, as issue #7's schema tests are); verify they fail only because the functions and table do not exist yet

## 2. Shared and database

- [ ] 2.1 Add `packages/shared/src/pairing.ts` (alphabet, constants, `generatePairingCode`, `normalizePairingCode`, `PairRequest`, `PairResponse`) and export it from `index.ts`; verify `pairing.test.ts` passes
- [ ] 2.2 Add migration `supabase/migrations/<timestamp>_device_pairing.sql` (`pair_attempts`, `register_pair_attempt`, `redeem_pairing_code`, grants) per design.md decision 5; verify `supabase/tests/pairing.test.ts` and the existing schema tests pass

## 3. Children

- [ ] 3.1 Add `apps/web/src/lib/children.ts` (`listChildren`, `addChild`, `renameChild`, `deleteChild`); verify `children.test.ts` passes
- [ ] 3.2 Add `apps/web/src/lib/pairing/create-code.ts` (`createPairingCode`, `PAIRING_ERROR_MESSAGES`); verify `create-code.test.ts` passes
- [ ] 3.3 Add `apps/web/src/components/children-list.tsx`, `app/dashboard/children/actions.ts` (server actions) and replace the placeholder `app/dashboard/children/page.tsx`; verify `children-list.test.ts` passes

## 4. Pair endpoint

- [ ] 4.1 Add `apps/web/src/lib/pairing/pair-device.ts` (`pairDevice`, `clientIp`, `sha256Hex`); verify `pair-device.test.ts` passes
- [ ] 4.2 Add `apps/web/src/lib/device/token.ts` (`hashDeviceToken`, SHA-256 lowercase hex) and `apps/web/src/lib/supabase/admin.ts` (imports `server-only`, service-role client, error naming a missing env var), and `app/api/device/pair/route.ts` (POST, wires deps, returns JSON with the status from `pairDevice`). If #10 already created the token or admin file, reuse it

## 5. Verify

- [ ] 5.1 Update `docs/architecture.md` key flow 2 and data model (`pair_attempts`, rate limit storage, single-use redeem)
- [ ] 5.2 Run `npm run check` and `npm run build` and fix all failures without weakening tests
