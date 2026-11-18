## MODIFIED Requirements

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
