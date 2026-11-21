## 1. Shared contract
- [x] 1.1 Tests: `siteAccess` in `HeartbeatRequest` and `HeartbeatEnvelope` (`contracts.test.ts`)
- [x] 1.2 Add optional `siteAccess` boolean to both schemas

## 2. Database
- [x] 2.1 Tests in `supabase/tests/site-access.test.ts` (column, trigger, RLS, purge, no pg_cron)
- [x] 2.2 Migration (use the `add-migration` skill; timestamp at build time): `devices.site_access`, `site_access_incidents`, trigger function, purge function, guarded cron job

## 3. Web: heartbeat
- [x] 3.1 Tests in `heartbeat.test.ts` and `supabase-store.test.ts`
- [x] 3.2 Pass `site_access` in the `updateDevice` patch only when `siteAccess` is present; extend `HeartbeatStore` type (optional field) and Supabase store

## 4. Web: banner and digest
- [x] 4.1 Tests: `site-access-banner.test.ts`, `offline-banner.test.ts`, digest `content.test.ts`, `send.test.ts`, `supabase-store.test.ts`
- [x] 4.2 `siteAccessLostLines` (order child, browser, device name), `loadSiteAccessLost`; split `offline-banner.tsx` into a pure `OfflineBannerView({ offline, siteAccessLost })` and a thin async `OfflineBanner` that loads both lists and renders the view
- [x] 4.3 `listSiteAccessIncidents` in `DigestSource`, the Supabase store and `buildDigest`

## 5. Extension
- [x] 5.1 Tests in `sender.test.ts`, `controller.test.ts` and `background.test.ts` (wiring)
- [x] 5.2 `siteAccess` in `FlushDeps` and the request body; `permissions` dependency in the controller, wired in the background entrypoint with `<all_urls>`, run from the existing minute alarm
- [x] 5.3 Also check the API-origin permission and store `apiAccess` locally (not sent)
