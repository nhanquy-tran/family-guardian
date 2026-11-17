# Notes: add-offline-alerts (#18)

## What changed

- Migration `20261118100000_offline_alerts.sql`: `alerts.incident_last_seen_at` (not null, backfilled), `alerts.emailed_at`, unique `(device_id, incident_last_seen_at)`, `find_offline_devices(p_now)` (service role only), `call_offline_alerts()` (Vault + `net.http_post`, 10 s timeout, warning when a secret is missing), and `offline-alerts` / `purge-pair-attempts` cron jobs guarded on `pg_cron`/`pg_net` being available. API roles lose all rights on `alerts` except `select` (RLS `alerts_select` unchanged).
- `lib/alerts/offline.ts` (handler: auth, claim before send, throttle, release on total failure), `resend.ts`, `supabase-store.ts`, `banner.ts`, `components/offline-banner.tsx` (rendered in `app/dashboard/layout.tsx`), route `app/api/alerts/offline/route.ts` (POST only).
- `ALERT_FROM_EMAIL` added to `apps/web/.env.example`; `docs/human-setup.md` already documented the Vault and env steps (section 9).

## Scenario verification

All scenarios are covered by the committed test-writer tests (handler, resend, store, banner, route, PGlite migration tests). `npm run check` and `npm run build` pass. The cron wiring and the purge job are checked by hand on production after merge (`select jobname, schedule from cron.job`, then a silent test device for 15 min).

## Deviations to check

- **Migration timestamp**: current UTC time (`20261117...`) is earlier than the existing `20261118090000_devices_name.sql` on main, so I used `20261118100000` to be later than every existing file (rule: later than all migrations).
- **Existing test edited, not weakened**: `supabase/tests/schema.test.ts` inserted into `alerts` without `incident_last_seen_at`, which is now NOT NULL by spec. I added `incident_last_seen_at, now()` to those inserts; assertions are unchanged.
- Bearer comparison reuses `hashDeviceToken` (the repo's single SHA-256 helper, enforced by `shared-helpers.test.ts`) and `timingSafeEqual`.

## Docs to update

- `docs/architecture.md`: `alerts` row becomes `alerts(id, device_id, kind, sent_at, incident_last_seen_at, emailed_at)`; flow 6: pg_cron every 5 min calls `POST /api/alerts/offline` through pg_net (secret from Vault); the endpoint detects silent devices (15 min to 24 h), e-mails parents via Resend at most once per device per 24 h, and the dashboard banner shows every active incident.

## Human should check

- After merge: Vault secrets `app_url` and `alert_cron_secret` exist, Vercel env `ALERT_CRON_SECRET`, `ALERT_FROM_EMAIL`, `RESEND_API_KEY` set and redeployed, `cron.job` lists both jobs.
