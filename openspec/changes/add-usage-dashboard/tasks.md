## 1. Tests first

- [x] 1.1 Create `packages/shared/src/usage-summary.test.ts` with tests for: Day range in a fixed offset zone, Daylight-saving day is 23 hours, Late UTC minute belongs to next local day, Totals and categories, Only ten sites, Empty day, Seven days with gaps, Days split by timezone, Week top sites, Dominant category per minute, Minute of day is local, Valid timezone, Invalid or missing timezone; confirm they fail
- [x] 1.2 Create `apps/web/src/lib/usage.test.ts` with tests for: Child of another family, More than 1000 rows, Query failure, Duration formatting, Bar segments Child lookup failure, Aggregation call failure, Failure on a later page, Error state shown (fake Supabase client); confirm they fail

- [x] 1.3 Create `supabase/tests/usage.test.ts` (PGlite harness) with tests for: Week with more than 1000 rows sums correctly, Days split by timezone in SQL, Timeline returns one row per minute, Other family's child, Invalid timezone, Days out of range, Anonymous caller; confirm they fail

## 2. Implementation

- [x] 2.0 Add migration `supabase/migrations/20261118100000_usage_functions.sql` (`usage_by_day`, `usage_timeline`: security invoker, `set search_path = ''`, tz validated against `pg_timezone_names`, revoke from public/anon)

- [x] 2.1 Create `packages/shared/src/usage-summary.ts` (`dayRangeUtc`, `localDay`, `summarizeDay`, `summarizeWeek`, `buildTimeline`, `resolveTimezone`) and export it from `index.ts`
- [x] 2.2 Create `apps/web/src/lib/usage.ts` (`loadUsage` with explicit-range paging via RPC and error result, `formatDuration`, `barSegments`, category colour map)
- [x] 2.3 Create page `apps/web/src/app/dashboard/usage/[childId]/page.tsx` (Today/Week, `notFound()` for unknown child, error state with no numbers) and client component `TimezoneSync`
- [x] 2.4 Link each child to the usage page from `apps/web/src/app/dashboard/page.tsx`
- [ ] 2.5 Update `docs/architecture.md` with the usage view and the timezone-from-browser note (not done by the developer; listed in NOTES.md under "Docs to update")

## 3. Verify

- [ ] 3.1 Check the page at 375 px on the preview and record it in the PR (scenario "Phone layout"; manual)
- [x] 3.2 Run `npm run check` and `npm run build` and fix all failures
