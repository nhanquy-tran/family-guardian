# Notes: extension-block-enforcement (#15)

## What changed
- `lib/rules.ts`: `buildRules`, `applyRules` (one atomic `updateDynamicRules`), `syncRules` (GET rules, validate with `RulesResponse`, apply, then store; any failure keeps old rules and version).
- `lib/blocked.ts`: `parseBlockedQueue`, `pruneBlocked` (7 days, newest 1000), `addBlocked`, `parseBlockedMessage`.
- `lib/sender.ts`: `blocked` is added to the first request only (not on keep-alive, omitted when empty) and removed from storage only after a 200.
- `lib/controller.ts`: `syncRules` after an `ok` heartbeat when `rulesVersion` differs; `recordBlocked` (needs a token and a domain in `rulesDomains`). `get` and `dnr` stay optional in `ControllerDeps` (as already on main); sync is skipped if absent.
- `lib/pairing.ts`: a successful pair also removes `rulesVersion` and `blockedQueue`.
- `lib/storage.ts`: `fetchGet` (30 s timeout). `lib/manifest.ts` and `wxt.config.ts`: new permissions.
- `entrypoints/blocked/main.ts` and the page show the domain and message `{type:"blocked", domain}`. `background.ts` wires `get`, `dnr` and the message.

## Verification
Each scenario is covered by the test-writer's tests in `rules.test.ts`, `blocked.test.ts`, `manifest.test.ts`, `sender.test.ts`, `controller.test.ts` and `pairing.test.ts`. `npm run check` (385 tests) and `npm run build` pass. No test was changed.

## Human should check
- `<all_urls>` host permission: justify it in the store listing.
- The DNR redirect and blocked page were not exercised in a real browser; try one blocked navigation manually.

## Docs to update
- `docs/architecture.md` flow 4: rules fetched after a heartbeat when the version differs, stored in `rulesVersion`/`rulesDomains`, enforced by dynamic DNR redirect rules; blocked attempts queued in `blockedQueue` and sent in the first heartbeat request.
- `docs/platform-notes.md` (MV3): `<all_urls>` is needed for redirects; `blocked.html` must be web accessible; `requestDomains` matches subdomains; 5000 dynamic redirect rule limit; redirect rules do not affect already-open tabs.
