## 1. Shared (`packages/shared/src/extension.test.ts`, `pairing.test.ts`, `contracts.test.ts`)
- [ ] 1.1 Add `FIREFOX_ADDON_ID`, `FIREFOX_UPDATE_URL` to `packages/shared/src/extension.ts`
- [ ] 1.2 Add `firefox` to the shared browser enum used by `PairRequest`, `HeartbeatRequest`, `HeartbeatEnvelope`

## 2. Database (`supabase/tests/schema.test.ts`, `supabase/tests/firefox-device.test.ts`)
- [ ] 2.1 Migration: add `firefox` to the `devices.browser` check (timestamp = current UTC time at build)

## 3. Extension (`apps/extension/lib/manifest.test.ts`, `build-config.test.ts`, `browser-info.test.ts`, `badge.test.ts`, `controller.test.ts`, `tracker.test.ts`, `firefox-docs.test.ts`)
- [ ] 3.1 `buildFirefoxManifest`, `FIREFOX_MANIFEST_VERSION`, Chromium manifest fixture; wire `wxt.config.ts` per target
- [ ] 3.2 `zip:firefox` and `build:firefox` scripts in `apps/extension/package.json`
- [ ] 3.3 `detectBrowser` returns `firefox`; `parseBrowserName`; use it in `background.ts`
- [ ] 3.4 Action API fallback (`action ?? browserAction`) for the badge
- [ ] 3.5 Non-persistent event page for the Firefox background

## 4. Web (`apps/web/src/lib/devices/status.test.ts`, `apps/web/src/components/device-list.test.ts`)
- [ ] 4.1 `browserLabel` returns "Firefox"; devices page shows it

## 5. Docs
- [ ] 5.1 `docs/platform-notes.md` Firefox section: manifest-version finding with reason, smoke checklist
- [ ] 5.2 Update `apps/extension/CLAUDE.md` (Firefox target, store builds)
