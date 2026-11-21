## 1. Shared (`packages/shared/src/extension.test.ts`, `pairing.test.ts`, `contracts.test.ts`)
- [x] 1.1 Add `FIREFOX_ADDON_ID`, `FIREFOX_UPDATE_URL` to `packages/shared/src/extension.ts`
- [x] 1.2 Add `firefox` to the shared browser enum used by `PairRequest`, `HeartbeatRequest`, `HeartbeatEnvelope`

## 2. Database (`supabase/tests/schema.test.ts`, `supabase/tests/firefox-device.test.ts`)
- [x] 2.1 Migration: add `firefox` to the `devices.browser` check (timestamp = current UTC time at build)

## 3. Extension (`apps/extension/lib/manifest.test.ts`, `build-config.test.ts`, `browser-info.test.ts`, `badge.test.ts`, `controller.test.ts`, `tracker.test.ts`, `firefox-docs.test.ts`)
- [x] 3.1 `buildFirefoxManifest`, `FIREFOX_MANIFEST_VERSION`, Chromium manifest fixture; wire `wxt.config.ts` per target
- [x] 3.2 `zip:firefox` and `build:firefox` scripts in `apps/extension/package.json`
- [x] 3.3 `detectBrowser` returns `firefox`; `parseBrowserName`; use it in `background.ts`
- [x] 3.4 `resolveBadgeApi(browser)` in `lib/browser-info.ts` (`action ?? browserAction ?? undefined`) used for the badge
- [x] 3.5 Non-persistent event page for the Firefox background (`persistent: false`); Chromium manifest keeps no `persistent` key
- [x] 3.6 Export `manifestFor` from `wxt.config.ts` (sets `manifestVersion` from `FIREFOX_MANIFEST_VERSION` for Firefox); `zip.sourcesRoot` = repository root with include/exclude lists
- [x] 3.7 Root `package.json` `build` also runs `npm run build:firefox -w extension`

## 3b. Expected edits to existing tests
`firefox` is now a valid browser, so the existing tests that used it as the invalid value change to `netscape`. These edits are expected and are not test weakening: `apps/web/src/lib/device/heartbeat.test.ts` ('Envelope check order', 'Envelope failure') and `apps/web/src/lib/pairing/pair-device.test.ts` ('Malformed body'). `supabase/tests/schema.test.ts` 'Invalid enum values rejected' does the same.
- [x] 3b.1 Switch the invalid browser value from `firefox` to `netscape` in those tests

## 4. Web (`apps/web/src/lib/devices/status.test.ts`, `apps/web/src/components/device-list.test.ts`)
- [x] 4.1 `browserLabel` returns "Firefox"; devices page shows it

## 5. Docs
- [x] 5.1 `docs/platform-notes.md` Firefox section: manifest-version finding with reason, smoke checklist including a real block test (blocked domain redirects to `blocked.html`; a category limit and allowed hours also block)
- [x] 5.2 Update `apps/extension/CLAUDE.md` (Firefox target, store builds)
