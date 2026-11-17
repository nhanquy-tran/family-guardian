# Notes: add-devices-page (#13)

## Status: blocked on one test (needs human)

`npm run build` passes. `npm run check` passes except one test: 1 of 186 fails.

`apps/web/src/components/device-list.test.ts` > "cancel deletes nothing" asserts `expect(html).not.toContain("<script")` on the markup of `DeviceList`.
`renderToStaticMarkup` always appends React's form-replay bootstrap `<script>addEventListener("submit", ...)</script>` once the markup contains a `<form action={fn}>` with a function action. The spec requires exactly that (a form with `action` bound to `removeAction`; the rename form is bound the same way). So the assertion cannot hold for any implementation that satisfies the spec's "form bound to `removeAction`" scenario. I did not edit the test.

The script is React's own and is not a client-JS dependency: the confirm step works without it. Suggested fix for the test writer: assert that no `<script` appears outside React's replay bootstrap, for example `html.replace(/<script>addEventListener\("submit".*?<\/script>/s, "")`, or drop the `<script` check and keep `onclick`. The spec text ("no `<script` and no `onclick`") may also want a note about this.

## What changed

- `supabase/migrations/20261117120000_devices_name.sql`: nullable `devices.name` (1..40), select grant on `name`, update limited to the `name` column, `devices_update_own` policy scoped to the parent's family.
- `apps/web/src/lib/devices/status.ts`, `devices.ts`: status, labels, list, rename, remove, error messages.
- `apps/web/src/components/device-list.tsx`: server-rendered list with rename form, Remove link and `?remove=` confirmation panel.
- `apps/web/src/app/dashboard/devices/actions.ts`, `page.tsx`: server actions and page using `createClient()` (no service-role client).
- `docs/architecture.md`: `name` added to the `devices` data model.

## How scenarios are verified

- Status, label and formatting scenarios: `status.test.ts`.
- List, rename, remove and error-code scenarios: `devices.test.ts` with fake clients.
- Markup scenarios: `device-list.test.ts` (all pass except the `<script` assertion above).
- Database scenarios (columns, RLS, column privileges, token revocation): `supabase/tests/devices.test.ts` (PGlite), passing.

## For the human to check

- The migration only applies to production on merge. Check rename and remove on production right after merge (Vercel previews use the production database; see `docs/factory-learnings.md`).
- Task 4.2 is left unticked until the test above is resolved.
