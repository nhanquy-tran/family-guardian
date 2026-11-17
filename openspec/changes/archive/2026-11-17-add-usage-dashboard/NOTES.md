# Notes: add-usage-dashboard (#12)

## What changed
- `supabase/migrations/20261118100000_usage_functions.sql`: `usage_by_day`, `usage_timeline` (security invoker, `search_path = ''`, tz checked against `pg_timezone_names`, days 1 to 31, revoked from public/anon, granted to authenticated).
- `packages/shared/src/usage-summary.ts`: day range, local day, summaries, timeline, `resolveTimezone`.
- `apps/web/src/lib/usage.ts`: `loadUsage` (explicit `.range()` paging, any failure gives `error`), `formatDuration`, `barSegments`, colour map.
- Page `/dashboard/usage/[childId]` (with `usage-view.tsx`, `timezone-sync.tsx`) and a "View usage" link per child on `/dashboard`.

## Deviations from the spec / main
- Migration timestamp: the spec said `20261118000000`, but main already has `20261118090000` and the build clock is earlier than that. I used `20261118100000` so it sorts after every existing file. Check it is still the newest at merge.
- `TimelineRow` (type stub from the test writer, using `minuteUtc`) is now a union that also accepts `minuteOfDay`, because the SQL function already returns the local minute of day. Shared tests use `minuteUtc`; `loadUsage` passes `minuteOfDay`. This avoids DST errors from rebuilding instants.
- Test files were not touched.

## Verification
Every scenario with a test is covered by the committed tests (`usage-summary.test.ts`, `usage.test.ts`, `supabase/tests/usage.test.ts`). `npm run check` (383 tests) and `npm run build` pass.
Manual and not verified: "Phone layout" at 375 px (task 3.1) and "Unauthenticated parent". Previews use the production DB, which gets the functions only after merge, so the preview shows the error state until the migration has run.

## Docs to update
- `docs/architecture.md`: add the usage view (`/dashboard/usage/[childId]`, SQL aggregation functions) and the note that the timezone comes from the browser via `?tz=` (not stored or logged).
