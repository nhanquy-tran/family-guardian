# digest-emails Specification

## Purpose
Send each family one digest e-mail per period (daily or weekly) with offline incidents and usage, instead of one e-mail per offline incident.

Test files:
- `supabase/tests/digest-emails.test.ts`: migration on the PGlite harness (stubs for `vault.decrypted_secrets` and `net.http_post`).
- `apps/web/src/lib/digest/schedule.test.ts`: `latestDuePeriod`.
- `apps/web/src/lib/digest/settings.test.ts`: `saveDigestSettings` and `captureFamilyTimezone` with a fake client.
- `apps/web/src/lib/digest/content.test.ts`: `buildDigest` with a fake data source.
- `apps/web/src/lib/digest/send.test.ts`: `handleDigestSend` with a fake store and mailer. Valid auth is `Bearer s3cret`.
- `apps/web/src/lib/alerts/offline.test.ts`: `handleOfflineAlerts` with a fake store.

## Requirements

### Requirement: Digest settings storage
Each family SHALL have `timezone` (default `UTC`), `timezone_known` (default false), `digest_frequency` (`daily` or `weekly`, default `daily`) and `digest_hour` (0 to 23, default 8). `digest_runs` SHALL be readable and writable by the service role only and keyed by `(family_id, frequency, period_start)`.

#### Scenario: Defaults and checks
- **GIVEN** the migration is applied and a new family is created
- **WHEN** its row is read, then updated with frequency `monthly`, then hour `24`
- **THEN** it has `UTC`, `false`, `daily`, `8`, and both updates are rejected by check constraints

#### Scenario: Parents edit only their own family
- **GIVEN** parents of families A and B
- **WHEN** parent A updates `digest_hour` of family A, then tries family B, then reads `digest_runs`
- **THEN** the first succeeds, the second changes no row, the third is denied

#### Scenario: One claim per family, frequency and period
- **GIVEN** a `digest_runs` row for (family, `daily`, `2026-11-09`)
- **WHEN** the same key is inserted again, then (family, `weekly`, `2026-11-09`)
- **THEN** the first is rejected by the primary key and the second succeeds

### Requirement: Save digest settings
`saveDigestSettings({ frequency, hour, timezone })` SHALL accept `daily` or `weekly`, an integer hour 0 to 23 and an IANA timezone, update the caller's family and set `timezone_known` to true. `captureFamilyTimezone(tz)` SHALL set the timezone only while `timezone_known` is false.

#### Scenario: Valid save
- **GIVEN** a family on defaults
- **WHEN** a parent saves `weekly`, hour `6`, timezone `Europe/Zurich`
- **THEN** the update carries exactly those values with `timezone_known` true and the result is `{ ok: true }`

#### Scenario: Invalid input or failed update
- **GIVEN** any family, and a client whose update errors or changes zero rows
- **WHEN** saving with frequency `monthly`, hour `24`, `-1`, `8.5`, `"8"`, or timezone `Not/AZone`; and a valid save against the failing client
- **THEN** the invalid saves return `{ ok: false, error: "invalid" }` with no update sent, and the failing client returns `{ ok: false, error: "failed" }`

#### Scenario: First visit captures the timezone once
- **GIVEN** a family with `timezone_known` false, then one with true and `Asia/Tokyo`
- **WHEN** `captureFamilyTimezone("Europe/Zurich")` runs for each
- **THEN** the first is updated to `Europe/Zurich` with `timezone_known` true and the second is not updated

### Requirement: Due period
`latestDuePeriod(family, now)` SHALL return the period of the latest send moment at or before `now`: for daily the local day before the send moment, for weekly the Monday to Sunday before it, where the send moment is local `digest_hour:00` (daily: every day; weekly: Mondays) in the family timezone. It SHALL return `null` if the family was created after that send moment. An invalid stored timezone SHALL be treated as `UTC`.

#### Scenario: Daily around the send time
- **GIVEN** a daily family, hour 8, `UTC`
- **WHEN** now is `2026-11-18T08:00:00Z`, and `2026-11-18T07:59:00Z`
- **THEN** the periods start on `2026-11-17` and `2026-11-16`, each one local day long

#### Scenario: Weekly and catch-up
- **GIVEN** a weekly family, hour 8, `UTC`
- **WHEN** now is Monday `2026-11-16T08:00:00Z`, Wednesday `2026-11-18T12:00:00Z`, and Monday `2026-11-16T07:59:00Z`
- **THEN** the first two give the period Monday `2026-11-09` to Sunday `2026-11-15` and the third gives the week starting `2026-11-02`

#### Scenario: Timezone offset
- **GIVEN** a daily family, hour 8, `Asia/Tokyo` (UTC+9)
- **WHEN** now is `2026-11-17T23:00:00Z` (08:00 on the 18th in Tokyo)
- **THEN** the period is the Tokyo day `2026-11-17`, from `2026-11-16T15:00:00Z` to `2026-11-17T15:00:00Z`

#### Scenario: Invalid timezone and new family
- **GIVEN** a family with timezone `Bad/Zone`, and another created at `2026-11-18T09:00:00Z`, both daily with hour 8
- **WHEN** `latestDuePeriod` runs at `2026-11-18T09:30:00Z`
- **THEN** the first is computed as `UTC` and the second returns `null`

### Requirement: Digest content
For each child of the family the digest SHALL list offline incidents of the child's devices that started in the period (browser and OS, from, to or "still offline", in the family timezone), total active time, the top 3 domains by time, and the focus score over the period (`computeFocusScore` with `homeworkDomainsFor`), then the dashboard link. It SHALL be plain text with no URL except the dashboard link.

#### Scenario: Full child section
- **GIVEN** child "Mia" with an incident from `11:40` to `12:10` on Edge and Windows, usage of 5 domains, homework settings, timezone `UTC`
- **WHEN** `buildDigest` runs for a daily period
- **THEN** the text names `Mia`, `Edge`, `Windows`, `11:40` and `12:10`, shows total time, exactly the 3 domains with the most seconds in order, a focus score and `APP_URL/dashboard`

#### Scenario: Empty and partial cases
- **GIVEN** an incident with null `resolved_at`; a child with no incidents and no usage; a child without homework categories or domains
- **WHEN** `buildDigest` runs
- **THEN** the first shows "still offline", the second "No offline incidents" and "No activity" without a score, and the third says the focus score is not available and where to choose homework sites

#### Scenario: Weekly period
- **GIVEN** usage spread over 7 days
- **WHEN** `buildDigest` runs for a weekly period
- **THEN** totals, top sites and focus score cover all 7 days and the subject names the week's first and last day

#### Scenario: Usage read fails or is too large
- **GIVEN** two children, with usage reads failing for the first, and separately more than 30 pages for it
- **WHEN** `buildDigest` runs
- **THEN** the first section says "Usage unavailable" with none of its partial data, and the second is complete

#### Scenario: Only the family's data
- **GIVEN** two families with children and incidents
- **WHEN** the digest for family A is built
- **THEN** no name, device or domain of family B appears and every query is filtered by A's child ids

### Requirement: Digest delivery
`handleDigestSend` SHALL, for each family with a due period, claim `(family, frequency, period_start)` (skip if it exists), send the digest to every parent, keep the claim if at least one send succeeded or there are no recipients, and release it if all sends failed or building failed. One family failing SHALL NOT stop the others. Logs SHALL hold counts only.

#### Scenario: Once per period with two parents
- **GIVEN** a daily family with parents `a@x.test` and `b@x.test` and a store that behaves like the real one
- **WHEN** the handler runs twice within the same period
- **THEN** the mailer sent exactly two messages, one per address, and the responses are `200 { sent: 1, skipped: 0, failed: 0 }` then `200 { sent: 0, skipped: 1, failed: 0 }`

#### Scenario: Missed send is sent at the next run
- **GIVEN** a daily family, hour 8, never sent, and now `2026-11-18T13:00:00Z`
- **WHEN** the handler runs
- **THEN** the digest for the period starting `2026-11-17` is sent

#### Scenario: Claim lost or no parents
- **GIVEN** `claimDigest` returns false for one family, and another family has no parent e-mail
- **WHEN** the handler runs
- **THEN** nothing is sent for either, the second claim stays and `skipped` is 2

#### Scenario: Send failures
- **GIVEN** two parents and a mailer rejecting every send, then one rejecting only the first
- **WHEN** the handler runs
- **THEN** in the first case the claim is released, `failed` is 1 and a later run with a working mailer sends; in the second the claim stays and `sent` is 1

#### Scenario: Failures are isolated
- **GIVEN** two due families with a build error for the first, and separately a store failure while listing families
- **WHEN** the handler runs
- **THEN** the first claim is released and the second is sent (`failed` 1, `sent` 1); the listing failure gives `500 { error: "server_error" }` and no mail

#### Scenario: Logs carry only counts
- **GIVEN** any run
- **WHEN** the handler logs
- **THEN** the log contains no e-mail address, child name, domain, token or family id

### Requirement: Authentication and fail-closed configuration
The endpoint SHALL accept only `Authorization: Bearer <ALERT_CRON_SECRET>`, compared in constant time, else `401 { "error": "unauthorized" }` with no store or mailer call. If the secret is unset or empty it SHALL respond `500` and accept nothing. If `RESEND_API_KEY`, `ALERT_FROM_EMAIL` or `APP_URL` is missing it SHALL respond `500` before any claim.

#### Scenario: Wrong credentials
- **GIVEN** secret `s3cret`
- **WHEN** called with `null`, `""`, `"s3cret"`, `"Basic s3cret"`, `"Bearer wrong"`
- **THEN** each is `401 { error: "unauthorized" }` and no store or mailer method is called

#### Scenario: Not configured
- **GIVEN** the secret unset, then valid auth with `APP_URL` missing, then with the mail key missing
- **WHEN** the handler is called
- **THEN** each response is `500 { error: "server_error" }` and `claimDigest` is never called

### Requirement: Scheduled trigger and purge
A migration SHALL schedule job `send-digests` every 15 minutes running `call_send_digests()` when `pg_cron` and `pg_net` are available. The function SHALL POST to `<app_url>/api/digest/send` with the bearer secret and `timeout_milliseconds` 10000, both values from Vault, and do nothing but warn if either is missing. `purge_digest_runs()` SHALL delete rows older than 90 days and be scheduled daily. The endpoint SHALL then run the weekly report (weekly-report) only when the digest answered 200, and SHALL return the digest response unchanged. `purge_digest_runs()` also removes `weekly_report` claims.

#### Scenario: Migration loads and Vault handling
- **GIVEN** PGlite has no `pg_cron`, with stubs for `vault.decrypted_secrets` and `net.http_post`
- **WHEN** the migration runs, then `call_send_digests()` runs without secrets, then with both
- **THEN** the migration succeeds and the functions `call_send_digests`, `purge_digest_runs` and `resolve_offline_alerts` exist and are not executable by `anon` or `authenticated`; the first call warns and makes no request; the second calls `net.http_post` once with `timeout_milliseconds` 10000

#### Scenario: Purge
- **GIVEN** `digest_runs` rows claimed 91 and 89 days ago
- **WHEN** `purge_digest_runs()` runs
- **THEN** only the 91-day-old row is deleted

#### Scenario: Purge removes report claims
- **GIVEN** `digest_runs` rows with frequency `weekly_report` claimed 91 and 89 days ago
- **WHEN** `purge_digest_runs()` runs
- **THEN** only the 91-day-old row is deleted

#### Scenario: Cron wiring on production
- **GIVEN** the migration is applied and the Vault secrets exist
- **WHEN** `select jobname, schedule from cron.job` runs and a test family is due (manual check after merge, noted in the PR)
- **THEN** `send-digests` is listed with `*/15 * * * *` and one digest arrives

#### Scenario: Route runs both
- **GIVEN** valid auth, a due daily digest and a due opted-in report with fake stores and mailer
- **WHEN** the route handler is called
- **THEN** the response is `200` with the digest counts only, and both the digest and the report were mailed

#### Scenario: Digest failure stops the report
- **GIVEN** a digest run answering `500`, and separately wrong credentials
- **WHEN** the route handler is called
- **THEN** the response is that `500` or `401` and no report claim or mail happens

### Requirement: Offline endpoint records incidents without e-mail
`handleOfflineAlerts` SHALL keep its authentication and fail-closed secret check, find offline devices, claim each incident with `emailed_at` null (skip if the row exists), resolve incidents whose device has reported again by setting `resolved_at` to now, and SHALL NOT send e-mail or require mail configuration. `resolve_offline_alerts(p_now)` SHALL be executable by `service_role` only.

#### Scenario: Incident recorded, nothing mailed
- **GIVEN** one offline device and a fake store and mailer
- **WHEN** the handler runs twice
- **THEN** the claim is made once with `emailed_at` null, the mailer is never called, and the responses are `200 { recorded: 1, skipped: 0 }` then `200 { recorded: 0, skipped: 0 }`

#### Scenario: Returned device resolves its incident
- **GIVEN** an alert with `incident_last_seen_at` `11:40`, null `resolved_at`, and its device `last_seen_at` `11:55`, and another alert whose device still has `last_seen_at` equal to its incident
- **WHEN** `resolve_offline_alerts(p_now)` runs twice
- **THEN** the first alert's `resolved_at` equals `p_now` after the first run and is unchanged after the second, and the other stays unresolved

#### Scenario: Store failure and unconfigured secret
- **GIVEN** `findOfflineDevices` rejects, and separately an empty secret
- **WHEN** the handler runs
- **THEN** the first is `500 { error: "server_error" }`; the second is `500` and the store is never called
