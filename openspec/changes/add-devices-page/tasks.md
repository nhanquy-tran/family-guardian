# Tasks

Prerequisite: changes `add-database-schema` (#7) and `add-parent-google-sign-in` (#8) are merged.

## 1. Tests first

- [ ] 1.1 Write `supabase/tests/devices.test.ts` using `supabase/tests/harness.ts`, one test per database scenario in `specs/device-management/spec.md`; verify it fails only because the new migration does not exist yet
- [ ] 1.2 Write `apps/web/src/lib/devices/status.test.ts`, `apps/web/src/lib/devices/devices.test.ts` and `apps/web/src/components/device-list.test.ts` with one test per scenario, using fake Supabase clients and `renderToStaticMarkup`; verify they fail only because the modules do not exist yet

## 2. Database

- [ ] 2.1 Add `supabase/migrations/20261117120000_devices_name_and_version.sql` per design.md decision 1 (columns, column grants, revoke/grant update, `devices_update_own` policy); verify `devices.test.ts` and the existing `schema.test.ts` pass

## 3. Web

- [ ] 3.1 Add `apps/web/src/lib/devices/status.ts` (`ONLINE_THRESHOLD_MS`, `deviceStatus`, `formatLastSeen`, `browserLabel`, `deviceLabel`); verify `status.test.ts` passes
- [ ] 3.2 Add `apps/web/src/lib/devices/devices.ts` (`listDevicesByChild`, `renameDevice`, `removeDevice`); verify `devices.test.ts` passes
- [ ] 3.3 Add `apps/web/src/components/device-list.tsx`; verify `device-list.test.ts` passes
- [ ] 3.4 Add `apps/web/src/app/dashboard/devices/actions.ts` (server actions, `revalidatePath`, redirect with `?error=`) and replace the placeholder `page.tsx` with the real page (check `node_modules/next/dist/docs/` for `searchParams` and server actions)

## 4. Verify

- [ ] 4.1 Update the `devices` line of the data model in `docs/architecture.md` to include `name` and `extension_version`
- [ ] 4.2 Run `npm run check` and `npm run build` and fix all failures without weakening tests
