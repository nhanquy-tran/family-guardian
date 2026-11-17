# Spec Delta

## Purpose

Detect devices that went silent and tell the family's parents once per incident, by e-mail and on the dashboard.

Test files:
- `apps/web/src/lib/alerts/offline.test.ts`: `handleOfflineAlerts` with a fake `OfflineAlertStore` and fake `Mailer` recording calls. "Now" is `2026-11-17T12:00:00Z`. Valid auth is `Bearer s3cret` with secret `s3cret`.
- `apps/web/src/lib/alerts/resend.test.ts`: `createResendMailer` with a fake `fetch`.
- `apps/web/src/lib/alerts/supabase-store.test.ts`: `createOfflineAlertStore` with a fake Supabase client.
- `apps/web/src/lib/alerts/banner.test.ts`: `activeOfflineAlerts`.
- `apps/web/src/app/api/alerts/offline/route.test.ts`: exports of the route module.
- `supabase/tests/offline-alerts.test.ts`: migration, run on the PGlite harness.

## ADDED Requirements

### Requirement: Shared-secret authentication
The endpoint SHALL accept only `Authorization: Bearer <token>` where `<token>` equals `ALERT_CRON_SECRET`, compared in constant time. Otherwise it SHALL respond `401 { "error": "unauthorized" }` and touch neither the store nor the mailer. If `ALERT_CRON_SECRET` is unset or empty it SHALL respond `500 { "error": "server_error" }` and never accept any token. If `RESEND_API_KEY` or `ALERT_FROM_EMAIL` is unset it SHALL respond `500` after authentication and before any alert is claimed.

#### Scenario: Wrong or missing credentials
- **GIVEN** secret `s3cret`
- **WHEN** the handler is called with authorization `null`, `""`, `"s3cret"`, `"Basic s3cret"`, `"Bearer wrong"`
- **THEN** each response is `401 { error: "unauthorized" }`
- **AND** no store method and no mailer method is called

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

#### Scenario: One alert per incident
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
For each offline device the handler SHALL claim the alert (insert; skip the device if the row already exists), then send one e-mail to every parent of the child's family with child name, browser, OS and last-seen time in UTC. If it had at least one recipient and every send failed, it SHALL release the claim so the next run retries. With at least one successful send the claim stays. With zero recipients the claim stays and nothing is sent. A failure for one device SHALL NOT stop the other devices.

#### Scenario: Two parents are alerted once
- **GIVEN** device `dev-1` of child "Mia" (Edge, Windows) last seen `11:40:00Z`, and parents `a@x.test`, `b@x.test`
- **WHEN** the handler runs twice with a fake store that behaves like the real one (claim fails when the pair exists, `findOfflineDevices` excludes claimed pairs)
- **THEN** the mailer sent exactly two messages in total, one per address
- **AND** each body contains `Mia`, `Edge`, `Windows` and `2026-11-17 11:40 UTC`
- **AND** the first response is `200 { sent: 1, skipped: 0, failed: 0 }` and the second `200 { sent: 0, skipped: 0, failed: 0 }`

#### Scenario: Claim lost to a concurrent run
- **GIVEN** `findOfflineDevices` returns `dev-1` but `claimAlert` returns `false`
- **WHEN** the handler runs
- **THEN** no e-mail is sent and the response is `200 { sent: 0, skipped: 1, failed: 0 }`

#### Scenario: All sends fail
- **GIVEN** two parents and a mailer that rejects every send
- **WHEN** the handler runs
- **THEN** `releaseAlert` is called for the device and `failed` is 1
- **AND** the response is `200`, and the next run tries the device again

#### Scenario: One send fails
- **GIVEN** two parents and a mailer that rejects only the first
- **WHEN** the handler runs
- **THEN** the second parent is still sent the message, `releaseAlert` is not called and `sent` is 1

#### Scenario: No parents
- **GIVEN** a device whose family has no parent e-mail
- **WHEN** the handler runs
- **THEN** the mailer is not called, the claim stays and the response is `200 { sent: 0, skipped: 1, failed: 0 }`

#### Scenario: Store failure
- **GIVEN** `findOfflineDevices` rejects
- **WHEN** the handler runs
- **THEN** the response is `500 { error: "server_error" }` and the mailer is not called

#### Scenario: One device fails, others continue
- **GIVEN** two offline devices and `listParentEmails` rejects for the first
- **WHEN** the handler runs
- **THEN** the first claim is released, the second device is processed, and the response is `200 { sent: 1, skipped: 0, failed: 1 }`

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
The store SHALL use the service-role client: call `find_offline_devices`, claim with an insert that ignores conflicts, release by deleting that exact `(device_id, incident_last_seen_at)` row, and read parent e-mails from Supabase Auth by the family's `parents.user_id`. It SHALL throw on any client error.

#### Scenario: Claim and release
- **GIVEN** a fake client
- **WHEN** `claimAlert` is called with a device and last-seen time, then `releaseAlert`
- **THEN** it inserts `{ device_id, kind: "offline", incident_last_seen_at }` ignoring duplicates and returns whether a row was inserted
- **AND** release deletes only that device and incident

#### Scenario: Parent addresses
- **GIVEN** a family with two parents, one whose auth user has no e-mail
- **WHEN** `listParentEmails` is called
- **THEN** it returns only the one address

#### Scenario: Client error
- **GIVEN** a fake client whose call returns an error
- **WHEN** any store method is called
- **THEN** it throws

### Requirement: Scheduled trigger
A migration SHALL schedule job `offline-alerts` every 5 minutes (`*/5 * * * *`) running `call_offline_alerts()` when `pg_cron` and `pg_net` are available. The function SHALL POST to `<app_url>/api/alerts/offline` with `Authorization: Bearer <alert_cron_secret>`, both read from Supabase Vault. If either is missing it SHALL do nothing but raise a warning.

#### Scenario: Migration loads without cron extensions
- **GIVEN** the PGlite harness has no `pg_cron`
- **WHEN** the migration runs
- **THEN** it succeeds and `call_offline_alerts` and `find_offline_devices` exist

#### Scenario: Cron wiring on production
- **GIVEN** the migration is applied and the Vault secrets exist
- **WHEN** a test device stays silent for 15 minutes (manual check after merge, noted in the PR)
- **THEN** the job runs within 5 minutes and one e-mail arrives

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
