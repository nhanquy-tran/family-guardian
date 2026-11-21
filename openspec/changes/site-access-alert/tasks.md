## 1. Shared contract
- [ ] 1.1 Tests: `siteAccess` in `HeartbeatRequest` and `HeartbeatEnvelope` (`contracts.test.ts`)
- [ ] 1.2 Add optional `siteAccess` boolean to both schemas

## 2. Database
- [ ] 2.1 Tests in `supabase/tests/site-access.test.ts` (column, trigger, RLS, purge, no pg_cron)
- [ ] 2.2 Migration (use the `add-migration` skill; timestamp at build time): `devices.site_access`, `site_access_incidents`, trigger function, purge function, guarded cron job

## 3. Web: heartbeat
- [ ] 3.1 Tests in `heartbeat.test.ts` and `supabase-store.test.ts`
- [ ] 3.2 Pass `site_access` in the `updateDevice` patch (`?? true`); extend `HeartbeatStore` type and Supabase store

## 4. Web: banner and digest
- [ ] 4.1 Tests: `site-access-banner.test.ts`, `offline-banner.test.ts`, digest `content.test.ts`, `send.test.ts`, `supabase-store.test.ts`
- [ ] 4.2 `siteAccessLostLines`, `loadSiteAccessLost`, extend `OfflineBanner`
- [ ] 4.3 `listSiteAccessIncidents` in `DigestSource`, the Supabase store and `buildDigest`

## 5. Extension
- [ ] 5.1 Tests in `sender.test.ts` and `controller.test.ts`
- [ ] 5.2 `siteAccess` in `FlushDeps` and the request body; `permissions` dependency in the controller, wired in the background entrypoint with `<all_urls>`
