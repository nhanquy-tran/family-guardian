# Tasks

## 1. Tests first
- [ ] 1.1 `supabase/tests/weekly-report.test.ts` (migration scenarios)
- [ ] 1.2 `apps/web/src/lib/digest/schedule.test.ts`: report period scenarios (extend)
- [ ] 1.3 `apps/web/src/lib/digest/weekly-report.test.ts`: content scenarios
- [ ] 1.4 `apps/web/src/lib/digest/weekly-report-send.test.ts`: delivery and fail-closed scenarios
- [ ] 1.5 `apps/web/src/lib/alerts/resend.test.ts`: html passthrough (extend)
- [ ] 1.6 `apps/web/src/lib/digest/settings.test.ts`: `saveWeeklyReportSetting` (extend)
- [ ] 1.7 `apps/web/src/components/weekly-report-form.test.ts`
- [ ] 1.8 `apps/web/src/app/api/digest/send/route.test.ts`: route runs the report (extend)

## 2. Implementation
- [ ] 2.1 Migration (use the `add-migration` skill)
- [ ] 2.2 `reportPeriod` in `schedule.ts`
- [ ] 2.3 `weekly-report.ts` content and HTML/text rendering
- [ ] 2.4 `weekly-report-send.ts`, store additions (`listReportFamilies`, totals) in `supabase-store.ts`
- [ ] 2.5 Mailer `html` passthrough
- [ ] 2.6 Route wiring
- [ ] 2.7 `saveWeeklyReportSetting`, `WeeklyReportForm`, settings page and action
- [ ] 2.8 NOTES.md lists docs to update
