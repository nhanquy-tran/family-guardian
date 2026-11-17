# Tasks

## 1. Tests first

- [x] 1.1 Confirm #5, #6, #7, #9, #10, #12 and #14 are merged; if not, stop and report
- [x] 1.2 Write `supabase/tests/homework-settings.test.ts` and `packages/shared/src/homework.test.ts`
- [x] 1.3 Write `apps/web/src/lib/homework.test.ts` and `apps/web/src/lib/focus-overview.test.ts`
- [x] 1.4 Write `apps/web/src/components/focus-overview-view.test.ts` and `apps/web/src/components/homework-settings-view.test.ts`; verify the new tests fail only because the code is missing

## 2. Database

- [x] 2.1 Add `supabase/migrations/<build-time timestamp>_homework_settings.sql` per design decision 1; verify the database tests pass

## 3. Shared

- [x] 3.1 Add `packages/shared/src/homework.ts` with `homeworkDomainsFor` and export it from `index.ts`

## 4. Web

- [x] 4.1 `apps/web/src/lib/homework.ts` (settings module)
- [x] 4.2 `apps/web/src/lib/focus-overview.ts` (loader)
- [x] 4.3 `HomeworkSettingsView`, the `/dashboard/children/[childId]/homework` page and Server Actions, a "Homework" link per child on `/dashboard/children`
- [x] 4.4 `FocusOverviewView` and the `/dashboard` page with `TimezoneSync`

## 5. Verify

- [x] 5.1 Docs: `docs/architecture.md` is not edited by the developer; changes are listed in NOTES.md under "Docs to update"
- [x] 5.2 Run `npm run check` and `npm run build` and fix all failures without weakening tests
- [x] 5.3 In the PR body say how Server Actions were verified and that DB-dependent behaviour is checked on production after merge (previews share the production database)
