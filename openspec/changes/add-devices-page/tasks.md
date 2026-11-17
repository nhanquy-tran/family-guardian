# Tasks

Prerequisite: changes `add-database-schema` (#7), `add-parent-google-sign-in` (#8) and the heartbeat change (#10) are merged (all on `main`).

## 1. Tests first

- [x] 1.1 Write `supabase/tests/devices.test.ts` using `supabase/tests/harness.ts`, one test per database scenario in `specs/device-management/spec.md`; verify it fails only because the new migration does not exist yet
- [x] 1.2 Write `apps/web/src/lib/devices/status.test.ts`, `apps/web/src/lib/devices/devices.test.ts` and `apps/web/src/components/device-list.test.ts` with one test per scenario, using fake Supabase clients and `renderToStaticMarkup`; verify they fail only because the modules do not exist yet

## 2. Database

- [x] 2.1 Add `supabase/migrations/20261118090000_devices_name.sql` per design.md decision 1 (only the `name` column and its select grant, revoke/grant update, `devices_update_own` policy; do not touch `extension_version`); verify `devices.test.ts` and the existing `schema.test.ts` pass

## 3. Web

- [x] 3.1 Add `apps/web/src/lib/devices/status.ts` (`ONLINE_THRESHOLD_MS`, `deviceStatus`, `formatLastSeen`, `browserLabel`, `deviceLabel`); verify `status.test.ts` passes
- [x] 3.2 Add `apps/web/src/lib/devices/devices.ts` (`listDevicesByChild`, `renameDevice`, `removeDevice`, `deviceErrorMessage`); verify `devices.test.ts` passes
- [x] 3.3 Add `apps/web/src/components/device-list.tsx`; verify `device-list.test.ts` passes
- [x] 3.4 Add `apps/web/src/app/dashboard/devices/actions.ts` (server actions, `revalidatePath`, redirect with `?error=`) and replace the placeholder `page.tsx` with the real page using `createClient()` from `src/lib/supabase/server.ts` (no service-role client), including the `?remove=` confirmation panel (check `node_modules/next/dist/docs/` for `searchParams` and server actions)

## 4. Verify

- [x] 4.1 Update the `devices` line of the data model in `docs/architecture.md` to include `name`
- [ ] 4.2 Run `npm run check` and `npm run build` and fix all failures without weakening tests
