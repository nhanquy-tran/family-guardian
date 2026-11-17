## 1. Tests first

- [ ] 1.1 Create `packages/shared/src/usage-summary.test.ts` with tests for: Day range in a fixed offset zone, Daylight-saving day is 23 hours, Late UTC minute belongs to next local day, Totals and categories, Only ten sites, Empty day, Seven days with gaps, Days split by timezone, Week top sites, Dominant category per minute, Minute of day is local, Valid timezone, Invalid or missing timezone; confirm they fail
- [ ] 1.2 Create `apps/web/src/lib/usage.test.ts` with tests for: Child of another family, More than 1000 rows, Query failure, Duration formatting, Bar segments (fake Supabase client); confirm they fail

## 2. Implementation

- [ ] 2.1 Create `packages/shared/src/usage-summary.ts` (`dayRangeUtc`, `localDay`, `summarizeDay`, `summarizeWeek`, `buildTimeline`, `resolveTimezone`) and export it from `index.ts`
- [ ] 2.2 Create `apps/web/src/lib/usage.ts` (`loadUsage` with paging and error result, `formatDuration`, `barSegments`, category colour map)
- [ ] 2.3 Create page `apps/web/src/app/dashboard/usage/[childId]/page.tsx` (Today/Week, `notFound()` for unknown child, error state) and client component `TimezoneSync`
- [ ] 2.4 Link each child to the usage page from `apps/web/src/app/dashboard/page.tsx`
- [ ] 2.5 Update `docs/architecture.md` with the usage view and the timezone-from-browser note

## 3. Verify

- [ ] 3.1 Check the page at 375 px on the preview and record it in the PR (scenario "Phone layout")
- [ ] 3.2 Run `npm run check` and `npm run build` and fix all failures
