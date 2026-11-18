# weekly-report Specification

## Purpose
Send opted-in families a weekly usage report e-mail per child (time, top categories and domains, focus, change versus the week before), reusing the digest trigger and sender.

Test files:
- `supabase/tests/weekly-report.test.ts`: migration on the PGlite harness.
- `apps/web/src/lib/digest/schedule.test.ts`: `reportPeriod`.
- `apps/web/src/lib/digest/weekly-report.test.ts`: `buildWeeklyReport` with fake source and totals.
- `apps/web/src/lib/digest/weekly-report-send.test.ts`: `handleWeeklyReportSend` with a fake store and mailer. Valid auth is `Bearer s3cret`.
- `apps/web/src/lib/alerts/resend.test.ts`: mailer body.
- `apps/web/src/lib/digest/settings.test.ts`: `saveWeeklyReportSetting` with a fake client.
- `apps/web/src/components/weekly-report-form.test.ts`: `WeeklyReportForm` rendered with `react-dom/server`.
- `apps/web/src/app/api/digest/send/route.test.ts`: route wiring.

## ADDED Requirements

### Requirement: Weekly report setting storage
Each family SHALL have `weekly_report_enabled` (boolean, default false), editable by the parents of that family only. `usage_total_seconds(p_child_ids, p_start, p_end)` SHALL return the summed seconds per child in `[p_start, p_end)`, be executable by `service_role` only, and use an empty `search_path`.

#### Scenario: Default and own-family edit
- **GIVEN** the migration is applied, a new family, and parents of families A and B
- **WHEN** the new family's row is read, then parent A updates `weekly_report_enabled` of family A, then tries family B
- **THEN** the default is `false`, the first update succeeds and the second changes no row

#### Scenario: Totals per child in the period
- **GIVEN** child 1 with 60 s at `2026-11-09T10:00Z`, 30 s at `2026-11-15T23:59Z` and 99 s at `2026-11-16T00:00Z`, and child 2 with no usage
- **WHEN** `usage_total_seconds` runs for both children over `2026-11-09T00:00Z` to `2026-11-16T00:00Z` as `service_role`
- **THEN** child 1 has 90 and child 2 has no row or 0

#### Scenario: Totals are not callable by parents
- **GIVEN** the migration is applied
- **WHEN** `anon` and `authenticated` execute `usage_total_seconds`
- **THEN** both are denied

### Requirement: Report period
`reportPeriod(family, now)` SHALL return the Monday to Sunday week before the latest Monday at local `digest_hour:00` in the family timezone that is at or before `now`, regardless of the family's digest frequency, with frequency `weekly_report` and the start of the week before. It SHALL return `null` if the family was created after that send moment. An invalid timezone SHALL be treated as `UTC`.

#### Scenario: Monday at the send hour and catch-up
- **GIVEN** a family on `daily`, hour 8, `UTC`
- **WHEN** now is Monday `2026-11-16T08:00:00Z`, Wednesday `2026-11-18T12:00:00Z`, and Monday `2026-11-16T07:59:00Z`
- **THEN** the first two give the week starting `2026-11-09` (previous week start `2026-11-02`) and the third gives the week starting `2026-11-02`, all with frequency `weekly_report`

#### Scenario: Timezone and new family
- **GIVEN** a family in `Asia/Tokyo` with hour 8, one with timezone `Bad/Zone`, and one created after the send moment
- **WHEN** now is `2026-11-15T23:00:00Z` (Monday 08:00 in Tokyo)
- **THEN** the Tokyo week runs from `2026-11-08T15:00:00Z` to `2026-11-15T15:00:00Z`, the invalid timezone is computed as `UTC`, and the new family gets `null`

### Requirement: Report content
For each child of the family the report SHALL show total active time, the top 5 categories with time (`categorize` from `@fg/shared`), the top 5 domains with time, the average focus score and the change in total time versus the week before. A child without usage in the week SHALL show only "No activity this week". It SHALL carry only domains, categories and times (ADR 0005), contain no URL except the dashboard link, and use no tracking pixel.

#### Scenario: Full child section
- **GIVEN** child "Mia" with 7 domains over several categories, usage this week totalling 10 h and 8 h the week before, in `UTC`
- **WHEN** `buildWeeklyReport` runs
- **THEN** the text and the HTML name `Mia`, show the total, exactly the 5 categories and the 5 domains with the most seconds in order with their times, and the change "+25%" with "+2 h 00 min"

#### Scenario: Focus score is the mean of daily scores
- **GIVEN** homework domains set and usage on two days whose daily scores are 100 and 50, and a third day with no usage
- **WHEN** `buildWeeklyReport` runs
- **THEN** the average focus score is 75 and days without a score are not counted

#### Scenario: No activity
- **GIVEN** a child with no usage rows in the week, and another with usage
- **WHEN** `buildWeeklyReport` runs
- **THEN** the first section says "No activity this week" with no total, categories, domains, score or change, and the second is complete

#### Scenario: Partial cases
- **GIVEN** a child without homework settings, a child whose previous week total is 0, and separately a family with no children
- **WHEN** `buildWeeklyReport` runs
- **THEN** the first says "Focus score not available", the second says "no activity the week before" instead of a percentage, and the third report says "No children in this family yet."

#### Scenario: Read failures stay local
- **GIVEN** two children with usage reads failing for the first (and separately more than 30 pages for it), and separately a failing previous-week totals call
- **WHEN** `buildWeeklyReport` runs
- **THEN** the first section says "Usage unavailable" with none of its partial data and the second is complete; with the failing totals call the change reads "not available" and the rest is shown

#### Scenario: Accessible HTML without trackers
- **GIVEN** a child named `<b>Mia</b>` and usage with several domains
- **WHEN** `buildWeeklyReport` runs
- **THEN** the HTML has a `lang` attribute, one `<h1>`, `<th scope=` headers for the tables, no `<img`, no `<script`, no `<link`, the only URL is `APP_URL/dashboard`, and the name appears escaped (`&lt;b&gt;`)

#### Scenario: Subject and only the family's data
- **GIVEN** two families with children and a report for family A for the week starting `2026-11-09`
- **WHEN** `buildWeeklyReport` runs for A
- **THEN** the subject is `Family Guardian: weekly report 2026-11-09 to 2026-11-15`, no name or domain of family B appears and every query is filtered by A's child ids

### Requirement: Report delivery
`handleWeeklyReportSend` SHALL, for each opted-in family with a report period, claim `(family, weekly_report, period_start)` in `digest_runs` (skip if it exists) and send an HTML and text report to every parent. It SHALL keep the claim if one send succeeded or there are no recipients, and release it if all sends or the build failed. One family failing SHALL NOT stop the others, and logs SHALL hold counts only.

#### Scenario: Once per week with two parents
- **GIVEN** an opted-in family with parents `a@x.test` and `b@x.test` and a store that behaves like the real one
- **WHEN** the handler runs twice on Monday after the send hour
- **THEN** the mailer sent exactly two messages, each with `html` and `text`, and the responses are `200 { sent: 1, skipped: 0, failed: 0 }` then `200 { sent: 0, skipped: 1, failed: 0 }`

#### Scenario: Opt-in only
- **GIVEN** one family with the setting on and one with it off
- **WHEN** the handler runs
- **THEN** only the first is claimed and mailed

#### Scenario: Claim key does not collide with the digest
- **GIVEN** a weekly digest claim for (family, `weekly`, `2026-11-09`) exists
- **WHEN** the report is claimed for the same period start
- **THEN** the claim is made with frequency `weekly_report` and the report is sent

#### Scenario: Claim lost or no parents
- **GIVEN** `claimDigest` returns false for one family, and another family has no parent e-mail
- **WHEN** the handler runs
- **THEN** nothing is sent for either, the second claim stays and `skipped` is 2

#### Scenario: Send and build failures
- **GIVEN** two parents and a mailer rejecting every send, then one rejecting only the first, and separately a build error for the first of two families
- **WHEN** the handler runs
- **THEN** with all sends failing the claim is released and `failed` is 1; with one failing the claim stays and `sent` is 1; with the build error the first claim is released and the second family is sent

#### Scenario: Listing failure and logs
- **GIVEN** a store failure while listing families, and separately a normal run
- **WHEN** the handler runs
- **THEN** the first gives `500 { error: "server_error" }` and no mail; the log of the second contains no e-mail address, child name, domain, token or family id

### Requirement: Report authentication and fail-closed configuration
`handleWeeklyReportSend` SHALL accept only `Authorization: Bearer <ALERT_CRON_SECRET>` compared in constant time, else `401 { "error": "unauthorized" }` with no store or mailer call. An unset or empty secret, or a missing mail key, sender address or `APP_URL`, SHALL give `500 { "error": "server_error" }` before any claim.

#### Scenario: Wrong credentials
- **GIVEN** secret `s3cret`
- **WHEN** called with `null`, `""`, `"s3cret"`, `"Basic s3cret"`, `"Bearer wrong"`
- **THEN** each is `401 { error: "unauthorized" }` and no store or mailer method is called

#### Scenario: Not configured
- **GIVEN** the secret unset, then valid auth with `APP_URL` missing, then with the mail not configured
- **WHEN** the handler is called
- **THEN** each response is `500 { error: "server_error" }` and `claimDigest` is never called

### Requirement: Report runs with the digest trigger
`POST /api/digest/send` SHALL run the digest first and, when the digest answered 200, the weekly report, and SHALL return the digest's response body unchanged. A failing or unauthorized digest SHALL return its own response and send no report. `createResendMailer` SHALL include `html` in the Resend request body only when the message has one.

#### Scenario: Route runs both
- **GIVEN** valid auth, a due daily digest and a due opted-in report with fake stores and mailer
- **WHEN** the route handler is called
- **THEN** the response is `200` with the digest counts only, and both the digest and the report were mailed

#### Scenario: Digest failure stops the report
- **GIVEN** a digest run answering `500`, and separately wrong credentials
- **WHEN** the route handler is called
- **THEN** the response is that `500` or `401` and no report claim or mail happens

#### Scenario: Mailer body
- **GIVEN** a Resend mailer with a fake fetch
- **WHEN** it sends a message with `text` only, then one with `text` and `html`
- **THEN** the first request body has no `html` key and the second has both

### Requirement: Weekly report setting in the settings page
`saveWeeklyReportSetting(client, enabled)` SHALL accept only a boolean, update only `weekly_report_enabled` of the caller's family, and return `{ ok: false, error: "failed" }` when the update errors or changes no row. `WeeklyReportForm` SHALL render a labelled "Weekly report" checkbox, unchecked unless enabled, a note about who receives the report and when, and a submit button.

#### Scenario: Valid save
- **GIVEN** a family on defaults
- **WHEN** a parent saves `true`, then `false`
- **THEN** each update carries exactly `{ weekly_report_enabled: <value> }` and the result is `{ ok: true }`

#### Scenario: Invalid input or failed update
- **GIVEN** a client whose update errors or changes zero rows
- **WHEN** saving `"true"`, `1`, `null`, `undefined`; and `true` against the failing client
- **THEN** the invalid saves return `{ ok: false, error: "invalid" }` with no update sent, and the failing client returns `{ ok: false, error: "failed" }`

#### Scenario: Form rendering
- **GIVEN** `WeeklyReportForm` with `enabled` false, then true
- **WHEN** it is rendered to static markup
- **THEN** the markup has a `<label>` "Weekly report" tied to a checkbox that is unchecked, then checked, a note mentioning Monday and all parents, and a submit button
