# Tasks

## 1. Tests first

- [x] 1.1 Confirm #14 (rules API, `blocked` contract) and the sender/pairing change are merged; if not, stop and report.
- [x] 1.2 Write `apps/extension/lib/rules.test.ts`, `blocked.test.ts`, `manifest.test.ts`; extend `sender.test.ts`, `controller.test.ts` and `pairing.test.ts` for the scenarios in `specs/block-enforcement/spec.md`; add the new `get` and `dnr` fakes to `test-fakes.ts` and to existing controller fixtures without weakening them. Verify they fail only because the code is missing.

## 2. Implementation

- [x] 2.1 `lib/rules.ts` (`buildRules`, `applyRules`, `syncRules`), `Get` and `fetchGet` in `lib/storage.ts`
- [x] 2.2 `lib/blocked.ts` (`parseBlockedQueue`, `addBlocked`, `parseBlockedMessage`); `blocked` handling in `lib/sender.ts`
- [x] 2.3 Controller: `syncRules` after an `ok` heartbeat, `recordBlocked`, new deps; `pairWithCode` clears `rulesVersion` and `blockedQueue`
- [x] 2.4 `lib/manifest.ts` and `wxt.config.ts`; `entrypoints/blocked/main.ts` + page; `background.ts` wiring (thin)

## 3. Verify

- [x] 3.1 Update `docs/architecture.md` (flow 4 details) and `docs/platform-notes.md` (`<all_urls>`, web accessible blocked page, requestDomains matches subdomains, redirect rule limit) — listed in NOTES.md under `## Docs to update` (the developer does not edit `docs/architecture.md`)
- [x] 3.2 Run `npm run check` and `npm run build`; fix all failures without weakening tests
