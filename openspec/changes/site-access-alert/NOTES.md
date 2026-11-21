## Test concerns
I did not touch tests. Two failures remain; both come from tests, not from the code:

1. `apps/web/src/lib/digest/send.test.ts:131` (typecheck, `npm run check` fails): the new "Listing fails" scenario calls `f.build.mockImplementation((fam, period) => ...)`, but `fakes()` types `build` as `vi.fn<(f: DigestFamilyRow) => Promise<DigestMessage>>` (line 71). The real `DigestStore.build` in `send.ts` already takes `(family, period)`. TS2345 plus two implicit-any errors. Fix: type the fake's `build` as `(f: DigestFamilyRow, p: DuePeriod) => ...`. The test passes at runtime.
2. `apps/web/src/components/design-adoption.test.ts:58` ("offline banner uses the soft warning style") greps the source of `offline-banner.tsx` for the literal `loadActiveOfflineAlerts(await createClient())`. design.md (and the new `OfflineBannerView` scenario) say the async `OfflineBanner` creates one client and loads both lists, so the literal no longer exists. I did not shape the code around the grep. Fix: relax the assertion to `loadActiveOfflineAlerts(` and `has not reported`.

Everything else passes: all other unit tests, `supabase/tests`, acceptance. `npm run build` was not run because the check does not pass yet.

# Summary
- Shared: optional `siteAccess` boolean on `HeartbeatRequest` and `HeartbeatEnvelope` (contracts tests).
- Database: migration `20261121102000_site_access.sql` with `devices.site_access` (parent select grant only), `site_access_incidents` (RLS, one open incident per device, cascade), trigger `record_site_access_change`, `purge_site_access_incidents` (service role only) and a guarded cron job (`supabase/tests/site-access.test.ts`).
- Heartbeat: `site_access` goes into the `updateDevice` patch only when the field is present (`heartbeat.test.ts`, `supabase-store.test.ts`).
- Banner: `siteAccessLostLines`, `loadSiteAccessLost`, pure `OfflineBannerView` plus thin `OfflineBanner`.
- Digest: `listSiteAccessIncidents` in the source, the Supabase store and `buildDigest` ("Site access off:" block).
- Extension: `siteAccess` in the flush body (also for the rejected keep-alive), `permissions.contains` for `<all_urls>` before each flush, API-origin check stored locally as `apiAccess` (not sent), wired in `background.ts`. A failed check omits the field and logs no detail.

# Docs to update
- `docs/architecture.md`: heartbeat carries `siteAccess`; `site_access_incidents` table and trigger.
- `docs/platform-notes.md`: `permissions.contains` for `<all_urls>` on Chromium; on Firefox MV2 (#173) host permissions cannot be revoked, so the check is a safety net there. Record the owner-check result below.
- Privacy policy page and store justifications: one sentence about the yes/no site-access value (ADR 0024).
- `docs/decisions/0025-site-access-incidents.md`: owner to accept (status is proposed).

# Owner steps
- Real-browser check on policy-installed Chrome and Firefox: can the user withhold site access at all (Chrome "on click", Firefox permission revoke), and does a heartbeat still arrive with `<all_urls>` withheld while the API origin is kept? Record the result in platform notes.
- Manual check of this change: on a Chromium browser where site access can be changed (confirm force-installed extensions allow it), withhold site access and expect the banner within two minutes. Not on Firefox MV2.
- If withholding is possible and heartbeats stop, the follow-up is CORS headers on the device routes for the extension origins, so heartbeats no longer need the API host permission. Not in scope here.

## Debugging
Both failures were wrong tests (verdict: test); no code changed.

1. `apps/web/src/lib/digest/send.test.ts` typecheck (TS2345, TS7006 x2).
   - Root cause: the `fakes()` helper typed `build` as `(f) => ...`, but `DigestStore.build` in `send.ts:31` is `(family, period)`. The new "Listing fails" scenario passes a two-argument implementation.
   - Evidence: `/tmp/check.log` lines 23-25; the test passes at runtime.
   - Change: imported `DuePeriod` and typed the fake as `vi.fn<(f: DigestFamilyRow, p: DuePeriod) => ...>`. No assertion changed.
2. `apps/web/src/components/design-adoption.test.ts:58` ("offline banner uses the soft warning style").
   - Root cause: the test grepped for the literal `loadActiveOfflineAlerts(await createClient())`. The design says `OfflineBanner` creates one client and loads both lists, so that literal no longer exists. The scenario's intent (warning style, offline alerts loaded, "has not reported") still holds.
   - Change: the assertion now checks `loadActiveOfflineAlerts(`. The other two assertions are untouched.

`npm run check` passes (0 lint errors, 1035 tests passed, 1 skipped). `npm run build` was not run.

## Hidden test verdict
HIDDEN VERDICT: code

1 of 6 hidden tests fails: `acceptance: a blank device name falls back to the browser label` (`acceptance/site-access-alert/site-access.test.ts:153`).
- Verdict: code.
- Evidence: offline-alerts spec says `<device>` is "name, else `<child>'s <browser> on <os>`", and a device "with no name" gets the fallback. The test passes `name: "   "`. Received `Blocking is off on    : site access was turned off`, so the banner shows an empty label. A whitespace-only name is not a usable name. `apps/web/src/lib/devices/status.ts:26` already treats names this way (`device.name?.trim()`). The cause is `apps/web/src/lib/alerts/site-access-banner.ts:22`: `r.name ?? ...` only falls back on null or undefined.
- Proposed change: in `site-access-banner.ts`, use `const label = r.name?.trim() || \`${r.children?.name ?? "A child"}'s ${capitalize(r.browser)} on ${r.os}\`;`. Optionally sort by the trimmed name too (line 19).
