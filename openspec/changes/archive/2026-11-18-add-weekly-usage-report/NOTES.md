# Notes

## Summary
- Migration `20261118140000_weekly_report.sql`: `families.weekly_report_enabled`, update grant, `usage_total_seconds` (service_role only). The system clock was older than the newest migration on main, so the timestamp was chosen newer than every existing one.
- `reportPeriod` (schedule.ts), `buildWeeklyReport` (weekly-report.ts), `handleWeeklyReportSend`, `createReportStore`/`createWeeklyTotals` (supabase-store.ts), mailer `html` passthrough, route wiring with `maxDuration = 300`, settings load/save, `WeeklyReportForm`, settings page and action.
- `readAllUsage` and `formatDuration` in content.ts are now exported for reuse.
- Each scenario is verified by the test file named in the weekly-report spec; `npm run check` and `npm run build` pass.

## Docs to update
- `docs/decisions/README.md`: add the line for ADR 0018 (weekly report).
- `openspec/specs/digest-emails` and `openspec/specs/offline-alerts`: apply the deltas (route runs the report; mailer html passthrough).
- `docs/architecture.md`: mention the weekly report running in `/api/digest/send` and `usage_total_seconds`.

## Test concerns
None.
