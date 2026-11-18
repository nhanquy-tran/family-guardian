# Tasks

## 1. Tests first
- [x] 1.1 `supabase/tests/weekly-report.test.ts` (migration scenarios)
- [x] 1.2 `apps/web/src/lib/digest/schedule.test.ts`: report period scenarios (extend)
- [x] 1.3 `apps/web/src/lib/digest/weekly-report.test.ts`: content scenarios
- [x] 1.4 `apps/web/src/lib/digest/weekly-report-send.test.ts`: delivery and fail-closed scenarios
- [x] 1.5 `apps/web/src/lib/alerts/resend.test.ts`: html passthrough (extend; offline-alerts delta)
- [x] 1.6 `apps/web/src/lib/digest/settings.test.ts`: `saveWeeklyReportSetting` and `loadWeeklyReportSetting` (extend)
- [x] 1.7 `apps/web/src/components/weekly-report-form.test.ts`
- [x] 1.8 `apps/web/src/app/api/digest/send/route.test.ts`: route runs the report (extend; digest-emails delta); extend `supabase/tests` purge test for `weekly_report` claims

## 2. Implementation
- [x] 2.1 Migration (use the `add-migration` skill)
- [x] 2.2 `reportPeriod` in `schedule.ts`
- [x] 2.3 `weekly-report.ts` content and HTML/text rendering
- [x] 2.4 `weekly-report-send.ts`, store additions (`listReportFamilies`, totals) in `supabase-store.ts`
- [x] 2.5 Mailer `html` passthrough
- [x] 2.6 Route wiring
- [x] 2.7 `saveWeeklyReportSetting`, `loadWeeklyReportSetting`, `WeeklyReportForm`, settings page (separate query, error state) and action
- [x] 2.8 Route `maxDuration`
- [x] 2.9 NOTES.md lists docs to update (including `docs/decisions/README.md` line for ADR 0018, `openspec/specs/digest-emails`, `openspec/specs/offline-alerts`)
