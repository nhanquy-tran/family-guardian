# Spec Delta

## Purpose

Detect devices that went silent, show every incident on the dashboard, and e-mail the family's parents at most once per device per 24 hours.

Test files:
- `apps/web/src/lib/alerts/offline.test.ts`: `handleOfflineAlerts` with a fake `OfflineAlertStore` and fake `Mailer` recording calls. "Now" is `2026-11-17T12:00:00Z`. Valid auth is `Bearer s3cret` with secret `s3cret`.
- `apps/web/src/lib/alerts/resend.test.ts`: `createResendMailer` with a fake `fetch`.
- `apps/web/src/lib/alerts/supabase-store.test.ts`: `createOfflineAlertStore` with a fake Supabase client.
- `apps/web/src/lib/alerts/banner.test.ts`: `activeOfflineAlerts`.
- `apps/web/src/app/api/alerts/offline/route.test.ts`: exports of the route module.
- `supabase/tests/offline-alerts.test.ts`: migration, run on the PGlite harness (with stub `vault.decrypted_secrets` and `net.http_post` for `call_offline_alerts`).

## ADDED Requirements

### Requirement: Shared-secret authentication
The endpoint SHALL accept only `Authorization: Bearer <token>` where `<token>` equals `ALERT_CRON_SECRET`, compared in constant time. Otherwise it SHALL respond `401 { "error": "unauthorized" }` and touch neither the store nor the mailer.

#### Scenario: Wrong or missing credentials
- **GIVEN** secret `s3cret`
- **WHEN** the handler is called with authorization `null`, `""`, `"s3cret"`, `"Basic s3cret"`, `"Bearer wrong"`
- **THEN** each response is `401 { error: "unauthorized" }`
- **AND** no store method and no mailer method is called

### Requirement: Fail closed when not configured
If `ALERT_CRON_SECRET` is unset or empty the endpoint SHALL respond `500 { "error": "server_error" }` and never accept any token. If `RESEND_API_KEY` or `ALERT_FROM_EMAIL` is unset it SHALL respond `500` after authentication and before any alert is claimed.

#### Scenario: Secret not configured
- **GIVEN** the secret is `undefined`, then `""`
- **WHEN** the handler is called with `Bearer ` and with `Bearer undefined`
- **THEN** each response is `500 { error: "server_error" }` and the store is never called

#### Scenario: Mail not configured
- **GIVEN** valid auth and one offline device, but `mailConfigured` is false
- **WHEN** the handler is called
- **THEN** the response is `500` and `claimAlert` is never called

### Requirement: Offline detection
`find_offline_devices(p_now)` SHALL return devices whose `last_seen_at` is at most `p_now - 15 minutes` and at least `p_now - 24 hours` and that have no `alerts` row with `kind = 'offline'` and `incident_last_seen_at = last_seen_at`. Its execute right SHALL belong to `service_role` only.

#### Scenario: Silence thresholds
- **GIVEN** devices last seen 14 min 59 s, exactly 15 min, 23 h 59 min, exactly 24 h and 24 h 1 s before `p_now`, plus one never seen (`last_seen_at` null)
- **WHEN** `find_offline_devices(p_now)` runs
- **THEN** it returns the 15 min, 23 h 59 min and 24 h devices only

#### Scenario: One incident is recorded once
- **GIVEN** a device last seen 20 min ago with an alert whose `incident_last_seen_at` equals its `last_seen_at`
- **WHEN** `find_offline_devices(p_now)` runs
- **THEN** the device is not returned
- **AND** after the device's `last_seen_at` moves forward and then becomes 15 min old again, it is returned again

#### Scenario: Function and table access
- **GIVEN** the migration is applied
- **WHEN** roles `anon` and `authenticated` try to execute `find_offline_devices` and `call_offline_alerts`, or insert into `alerts`
- **THEN** each is denied, and `service_role` can execute `find_offline_devices`

#### Scenario: Duplicate claim rejected
- **GIVEN** an alert for `(device, incident_last_seen_at)` exists
- **WHEN** a second row with the same pair is inserted
- **THEN** the unique constraint rejects it

### Requirement: Alert e-mail
For each offline device the handler SHALL claim the alert (insert; skip the device if the row already exists), then send one e-mail to every parent of the child's family with child name, browser, OS and last-seen time in UTC. The text SHALL include "This is normal if the laptop was switched off. If it should be on, check the browser."

#### Scenario: Two parents are alerted once
- **GIVEN** device `dev-1` of child "Mia" (Edge, Windows) last seen `11:40:00Z`, and parents `a@x.test`, `b@x.test`
- **WHEN** the handler runs twice with a fake store that behaves like the real one (claim fails when the pair exists, `findOfflineDevices` excludes claimed pairs)
- **THEN** the mailer sent exactly two messages in total, one per address
- **AND** each body contains `Mia`, `Edge`, `Windows`, `2026-11-17 11:40 UTC` and "This is normal if the laptop was switched off. If it should be on, check the browser."
- **AND** the first response is `200 { sent: 1, skipped: 0, failed: 0, throttled: 0 }` and the second `200 { sent: 0, skipped: 0, failed: 0, throttled: 0 }`

#### Scenario: Claim lost to a concurrent run
- **GIVEN** `findOfflineDevices` returns `dev-1` but `claimAlert` returns `false`
- **WHEN** the handler runs
- **THEN** no e-mail is sent and the response is `200 { sent: 0, skipped: 1, failed: 0, throttled: 0 }`

#### Scenario: No parents
- **GIVEN** a device whose family has no parent e-mail
- **WHEN** the handler runs
- **THEN** the mailer is not called, the claim stays and the response is `200 { sent: 0, skipped: 1, failed: 0, throttled: 0 }`

### Requirement: E-mail throttle
The handler SHALL send at most one alert e-mail per device per rolling 24 hours. If an alert e-mail for the device was sent less than 24 hours before now, the handler SHALL still record the incident (so the dashboard banner shows it) and send nothing. A claim that will be e-mailed SHALL carry `emailed_at = now`; a throttled claim SHALL carry `emailed_at = null`.

#### Scenario: Second incident within 24 hours
- **GIVEN** `dev-1` has an alert with `emailed_at` `2026-11-17T08:00:00Z` (4 h before now) for an earlier incident, and a new incident with `last_seen_at` `11:40:00Z`
- **WHEN** the handler runs
- **THEN** a claim row is recorded for the new incident with `emailed_at` null, the mailer is not called, and the response is `200 { sent: 0, skipped: 0, failed: 0, throttled: 1 }`
- **AND** `activeOfflineAlerts` still returns that alert for the banner

#### Scenario: Incident after 24 hours
- **GIVEN** `dev-1` has an alert with `emailed_at` `2026-11-16T11:59:59Z` (24 h 1 s before now), and a new incident
- **WHEN** the handler runs
- **THEN** the claim is recorded with `emailed_at` equal to now, both parents are e-mailed, and the response is `200 { sent: 1, skipped: 0, failed: 0, throttled: 0 }`

#### Scenario: Throttle boundary
- **GIVEN** `dev-1` last e-mailed exactly 24 h before now
- **WHEN** the handler runs
- **THEN** the device is e-mailed (the throttle applies only when strictly less than 24 h)

### Requirement: Send failures and isolation
If a device had at least one recipient and every send failed, the handler SHALL release the claim so the next run retries, and that failed attempt SHALL NOT start the throttle. With at least one successful send the claim stays. With zero recipients the claim stays and nothing is sent. A failure for one device SHALL NOT stop the other devices. A store failure while listing devices SHALL give `500 { "error": "server_error" }`. Logs SHALL hold counts only.

#### Scenario: All sends fail
- **GIVEN** two parents and a mailer that rejects every send
- **WHEN** the handler runs
- **THEN** `releaseAlert` is called for the device and `failed` is 1
- **AND** the response is `200`, and a later run with a working mailer e-mails the parents (the released claim left no `emailed_at`, so the throttle does not apply)

#### Scenario: One send fails
- **GIVEN** two parents and a mailer that rejects only the first
- **WHEN** the handler runs
- **THEN** the second parent is still sent the message, `releaseAlert` is not called and `sent` is 1

#### Scenario: Store failure
- **GIVEN** `findOfflineDevices` rejects
- **WHEN** the handler runs
- **THEN** the response is `500 { error: "server_error" }` and the mailer is not called

#### Scenario: One device fails, others continue
- **GIVEN** two offline devices and `listParentEmails` rejects for the first
- **WHEN** the handler runs
- **THEN** the first claim is released, the second device is processed, and the response is `200 { sent: 1, skipped: 0, failed: 1, throttled: 0 }`

#### Scenario: Logs carry only counts
- **GIVEN** any run
- **WHEN** the handler logs
- **THEN** log output contains no e-mail address, child name, token or device id

### Requirement: Resend mailer
The mailer SHALL `POST https://api.resend.com/emails` with `Authorization: Bearer <RESEND_API_KEY>`, JSON `{ from, to: [address], subject, text }` and no `html`. A non-2xx response or a thrown error SHALL be reported as a failed send, not thrown past the handler.

#### Scenario: Request shape
- **GIVEN** a fake `fetch` returning `200`
- **WHEN** the mailer sends to `a@x.test` for child "Mia"
- **THEN** `fetch` was called once with that URL, method `POST`, the bearer header, `to: ["a@x.test"]`, subject `Mia: laptop offline` and a `text` field and no `html` field

#### Scenario: Failure is contained
- **GIVEN** a fake `fetch` returning `429`, then one that throws
- **WHEN** the mailer sends
- **THEN** each call resolves to `{ ok: false }`

### Requirement: Supabase store
The store SHALL use the service-role client: call `find_offline_devices`, report via `hasRecentEmail(deviceId, since)` whether the device has an alert with `emailed_at` after `since`, claim with an insert that ignores conflicts, release by deleting that exact `(device_id, incident_last_seen_at)` row, and read parent e-mails from Supabase Auth by the family's `parents.user_id`. It SHALL throw on any client error.

#### Scenario: Claim and release
- **GIVEN** a fake client
- **WHEN** `claimAlert` is called with a device, last-seen time and `emailedAt`, then `releaseAlert`
- **THEN** it inserts `{ device_id, kind: "offline", incident_last_seen_at, emailed_at }` ignoring duplicates and returns whether a row was inserted
- **AND** release deletes only that device and incident

#### Scenario: Recent e-mail lookup
- **GIVEN** a fake client with alerts for `dev-1` emailed at `08:00` and for `dev-2` with `emailed_at` null
- **WHEN** `hasRecentEmail` is called with `since` `2026-11-16T12:00:00Z`
- **THEN** it is true for `dev-1` and false for `dev-2`

#### Scenario: Parent addresses
- **GIVEN** a family with two parents, one whose auth user has no e-mail
- **WHEN** `listParentEmails` is called
- **THEN** it returns only the one address

#### Scenario: Client error
- **GIVEN** a fake client whose call returns an error
- **WHEN** any store method is called
- **THEN** it throws

### Requirement: Scheduled trigger
A migration SHALL schedule job `offline-alerts` every 5 minutes (`*/5 * * * *`) running `call_offline_alerts()` when `pg_cron` and `pg_net` are available. The function SHALL POST to `<app_url>/api/alerts/offline` with `Authorization: Bearer <alert_cron_secret>` and `timeout_milliseconds` 10000, both values read from Supabase Vault. If either is missing it SHALL do nothing but raise a warning.

#### Scenario: Migration loads without cron extensions
- **GIVEN** the PGlite harness has no `pg_cron`
- **WHEN** the migration runs
- **THEN** it succeeds and `call_offline_alerts` and `find_offline_devices` exist

#### Scenario: Missing Vault secrets
- **GIVEN** a stub `vault.decrypted_secrets` view with no rows and a stub `net.http_post` that records calls
- **WHEN** `call_offline_alerts()` runs
- **THEN** it raises a warning and `net.http_post` is not called

#### Scenario: Request timeout
- **GIVEN** the stubs with both secrets present
- **WHEN** `call_offline_alerts()` runs
- **THEN** `net.http_post` is called once with `timeout_milliseconds` 10000

#### Scenario: Cron wiring on production
- **GIVEN** the migration is applied and the Vault secrets exist
- **WHEN** a test device stays silent for 15 minutes (manual check after merge, noted in the PR)
- **THEN** the job runs within 5 minutes and one e-mail arrives

### Requirement: Daily pairing purge job
The same migration SHALL schedule `cron.schedule('purge-pair-attempts', '17 3 * * *', 'select public.purge_pair_attempts()')` (ADR 0012), guarded the same way as the alert job: only when `pg_cron` is available.

#### Scenario: Migration still loads and keeps the purge function
- **GIVEN** the PGlite harness has no `pg_cron`
- **WHEN** the migration runs
- **THEN** it succeeds and `public.purge_pair_attempts()` still exists

#### Scenario: Purge job on production
- **GIVEN** the migration is applied
- **WHEN** `select jobname, schedule from cron.job` runs (manual check after merge, noted in the PR)
- **THEN** it lists `offline-alerts` with `*/5 * * * *` and `purge-pair-attempts` with `17 3 * * *`

### Requirement: Dashboard banner
`activeOfflineAlerts(rows)` SHALL keep only alerts whose device's current `last_seen_at` equals the alert's `incident_last_seen_at`, newest `sent_at` first. The dashboard layout SHALL render a banner for each, naming child, browser, OS and last-seen time, and nothing when there are none. A failed alerts query SHALL NOT break the page.

#### Scenario: Active and resolved alerts
- **GIVEN** alert A (device last seen `11:40`, `incident_last_seen_at` `11:40`) and alert B (device last seen `11:55`, `incident_last_seen_at` `11:30`)
- **WHEN** `activeOfflineAlerts([A, B])` runs
- **THEN** it returns `[A]`

#### Scenario: Ordering and empty
- **GIVEN** two active alerts with different `sent_at`, then an empty list
- **WHEN** `activeOfflineAlerts` runs on each
- **THEN** the first returns newest `sent_at` first and the second returns `[]`

#### Scenario: Banner query failure
- **GIVEN** the alerts query returns an error
- **WHEN** the banner data loader runs (`loadActiveOfflineAlerts` in `lib/alerts/banner.ts`, tested in `banner.test.ts`)
- **THEN** it returns `[]` and does not throw
