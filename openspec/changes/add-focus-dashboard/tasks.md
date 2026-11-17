# Tasks

## 1. Tests first

- [ ] 1.1 Confirm #5, #6, #7, #9, #10, #12 and #14 are merged; if not, stop and report
- [ ] 1.2 Write `supabase/tests/homework-settings.test.ts` and `packages/shared/src/homework.test.ts`
- [ ] 1.3 Write `apps/web/src/lib/homework.test.ts` and `apps/web/src/lib/focus-overview.test.ts`
- [ ] 1.4 Write `apps/web/src/components/focus-overview-view.test.ts` and `apps/web/src/components/homework-settings-view.test.ts`; verify the new tests fail only because the code is missing

## 2. Database

- [ ] 2.1 Add `supabase/migrations/<build-time timestamp>_homework_settings.sql` per design decision 1; verify the database tests pass

## 3. Shared

- [ ] 3.1 Add `packages/shared/src/homework.ts` with `homeworkDomainsFor` and export it from `index.ts`

## 4. Web

- [ ] 4.1 `apps/web/src/lib/homework.ts` (settings module)
- [ ] 4.2 `apps/web/src/lib/focus-overview.ts` (loader)
- [ ] 4.3 `HomeworkSettingsView`, the `/dashboard/children/[childId]/homework` page and Server Actions, a "Homework" link per child on `/dashboard/children`
- [ ] 4.4 `FocusOverviewView` and the `/dashboard` page with `TimezoneSync`

## 5. Verify

- [ ] 5.1 Update `docs/architecture.md` (`children.homework_domains`, overview, timezone param)
- [ ] 5.2 Run `npm run check` and `npm run build` and fix all failures without weakening tests
- [ ] 5.3 In the PR body say how Server Actions were verified and that DB-dependent behaviour is checked on production after merge (previews share the production database)
