# apps/extension

WXT for Chrome, Edge and Brave (Manifest V3) and Firefox (MV2, `-b firefox`, see `docs/platform-notes.md`). Entrypoints in `entrypoints/` (thin), logic in `lib/` (pure, unit-tested with fakes in `lib/test-fakes.ts`).

- Privacy (ADR 0005): reduce URLs to the registrable domain on entry (`registrableDomain` from `@fg/shared`); nothing else from a page is stored or sent.
- The service worker can stop at any time: keep state in `chrome.storage.local`, register listeners synchronously, and run all state changes through the controller's single promise chain.
- Requests are built from the zod contracts in `@fg/shared` (`HeartbeatRequest`, `PairRequest`), so no other field can be sent. At most `MAX_HEARTBEAT_ENTRIES` per heartbeat; split on `413`.
- A `401` never wipes local data (it marks the device rejected and retries every 15 minutes).
- Manifest comes from `lib/manifest.ts`; add a permission only with the change that uses it, and update `docs/chrome-web-store.md` justifications.
- Store builds: `WXT_API_BASE_URL=https://family-guardian.co npm run zip -w extension`. Firefox: `npm run build:firefox -w extension`, `npm run zip:firefox -w extension` (add-on zip plus sources zip for AMO).
