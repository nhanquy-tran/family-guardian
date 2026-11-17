# Tasks

## 0. Prerequisite

- [ ] 0.1 Confirm #38 (schema), the heartbeat API change (#10, `admin.ts`) and the dashboard shell are merged; do not build before

## 1. Tests first

- [ ] 1.1 Write `apps/web/src/lib/alerts/offline.test.ts` and `apps/web/src/lib/alerts/resend.test.ts` for the scenarios in `specs/offline-alerts/spec.md` (fake store, fake mailer, fake `fetch`)
- [ ] 1.2 Write `apps/web/src/lib/alerts/banner.test.ts`, `apps/web/src/lib/alerts/supabase-store.test.ts` and `apps/web/src/app/api/alerts/offline/route.test.ts`
- [ ] 1.3 Write `supabase/tests/offline-alerts.test.ts` on the PGlite harness (with stub `vault` and `net` for `call_offline_alerts`); verify all new tests fail only because code and migration do not exist

## 2. Implementation

- [ ] 2.1 Add migration `supabase/migrations/<timestamp>_offline_alerts.sql` (design 1, 6: `emailed_at`, both cron jobs, `timeout_milliseconds`); verify the PGlite tests pass
- [ ] 2.2 Add `lib/alerts/offline.ts` and `lib/alerts/resend.ts` (design 2 to 5); verify handler and mailer tests pass
- [ ] 2.3 Add `lib/alerts/supabase-store.ts` and `app/api/alerts/offline/route.ts` exporting only `POST`
- [ ] 2.4 Add `lib/alerts/banner.ts`, `components/offline-banner.tsx` and render it in `app/dashboard/layout.tsx`
- [ ] 2.5 Add `ALERT_FROM_EMAIL` to `apps/web/.env.example`; document Vault secrets `app_url` and `alert_cron_secret`, `ALERT_CRON_SECRET` and `ALERT_FROM_EMAIL` in `docs/human-setup.md`; update flow 6 and the `alerts` row in `docs/architecture.md`

## 3. Verify

- [ ] 3.1 Run `npm run check` and `npm run build` and fix all failures without weakening tests
- [ ] 3.2 Note in the PR that the cron job is checked on production right after merge
