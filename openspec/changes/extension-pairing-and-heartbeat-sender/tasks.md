# Tasks

## 0. Prerequisites

- [ ] 0.1 Confirm change #9 (`add-child-device-pairing`) is merged, so `normalizePairingCode`, `PairRequest` and `PairResponse` are exported from `@fg/shared`; do not build before. #4 (tracker) is already merged; #10 (heartbeat API) is needed only for end-to-end use

## 1. Tests first

- [ ] 1.1 Write `apps/extension/lib/config.test.ts`, `browser-info.test.ts` and `pairing.test.ts` for `specs/extension-pairing/spec.md` and the browser/OS scenarios (in-memory `KeyValueStore` fake, recording `post` fake)
- [ ] 1.2 Write `apps/extension/lib/queue.test.ts` and `sender.test.ts` for the queue, request-shape, chunking, 413 and failure scenarios in `specs/heartbeat-sender/spec.md`
- [ ] 1.3 Write `apps/extension/lib/controller.test.ts` for the schedule, controller, unauthorized and no-URL scenarios; verify all new tests fail only because the modules do not exist yet

## 2. Implementation

- [ ] 2.1 Add `lib/config.ts` (`resolveApiBaseUrl`), `lib/browser-info.ts` (`detectBrowser`, `osName`) and `apps/extension/.env.example` with `WXT_API_BASE_URL=`; verify their tests pass
- [ ] 2.2 Add `lib/storage.ts` (`KeyValueStore` type and `browser.storage.local` adapter, `Post` type and `fetch` adapter with a 30 s timeout) and `lib/pairing.ts` (`pairWithCode`, `PAIR_MESSAGES`, `connectionStatus`, design decision 9); verify pairing tests pass
- [ ] 2.3 Add `lib/queue.ts` and `lib/sender.ts` (`flushQueue`, design decisions 4 and 5); verify queue and sender tests pass
- [ ] 2.4 Add `lib/controller.ts` (`createController`, `registerSchedule`, design decisions 3, 6 and 7); verify controller tests pass
- [ ] 2.5 Rewrite `entrypoints/background.ts` to wire `tabs`, `windows`, `idle` and `alarms` events to the controller (design decision 8), and `entrypoints/options/*` with a code input, a Connect button, status "Connected." / "Not connected." and the `PAIR_MESSAGES` errors
- [ ] 2.6 Document `WXT_API_BASE_URL` (name only) in `docs/human-setup.md`, and the offline queue and pairing behaviour in `docs/architecture.md` (flows 2 and 3)

## 3. Verify

- [ ] 3.1 Run `npm run check` and `npm run build` and fix all failures without weakening tests
