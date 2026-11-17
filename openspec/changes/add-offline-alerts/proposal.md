# Proposal

Implements GitHub issue #18 ("Offline alert e-mail when a device goes silent") per ADR 0010.

## Why

A child can disable or remove the extension, or keep a laptop offline for long periods. Parents should hear about a device that stops reporting without checking the dashboard (architecture flow 6).

## What Changes

- `POST /api/alerts/offline` (`apps/web/src/app/api/alerts/offline/route.ts`): thin route over a tested handler `apps/web/src/lib/alerts/offline.ts`. Accepts only `Authorization: Bearer <ALERT_CRON_SECRET>` (constant-time compare). Fails closed.
- Detection: a device is offline when `last_seen_at` is 15 minutes or more ago and at most 24 hours ago, and no `offline` alert exists for that same `last_seen_at`. One alert per incident; another is possible only after the device reports again and goes silent again.
- E-mail via the Resend REST API (`fetch`, no new library) to every parent of the child's family: child name, device (browser, OS) and last seen. Plain text, no links.
- Migration: `alerts.incident_last_seen_at` with a unique `(device_id, incident_last_seen_at)` so concurrent runs cannot double-send; `find_offline_devices(now)` (service role only); `call_offline_alerts()` plus a `pg_cron` job every 5 minutes that calls the endpoint through `pg_net`, reading URL and secret from Supabase Vault.
- Dashboard banner (layout) listing alerts whose device has not reported since. It disappears when the device comes back.
- `ALERT_FROM_EMAIL` env name added to `apps/web/.env.example` and `docs/human-setup.md` (with the Vault setup steps).

## Data and privacy

No new kinds of data. The e-mail shows child name, browser, OS and last-seen time, all already stored and visible to that family's parents. Parent e-mail addresses are read from Supabase Auth at send time and never copied. Resend is already the accepted processor (ADR 0010). No new ADR: `incident_last_seen_at` copies a timestamp already in `devices`. Alert rows hold no personal data and are deleted with the device.

## Dependencies

Must be merged before building: #38 (initial schema, `alerts` table), the heartbeat API change (#10: writes `last_seen_at`, adds `admin.ts`), the dashboard shell, and the Resend account from the setup issue (#3).

## Out of scope

- "Back online" e-mails, repeat reminders, per-parent preferences, SMS or push.
- The child's "usual hours" from architecture flow 6 (ADR 0010 only requires active in the last 24 h).
- Alert retention/purge job and an alert history page.
- Telling a powered-off laptop from a removed extension.
