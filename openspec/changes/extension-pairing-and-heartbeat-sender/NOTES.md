# Notes

## Blocked: one test is wrong

`apps/extension/lib/controller.test.ts` > "pruning continues while rejected" (line ~204) fails, and I did not change it.

The test calls `onAlarm(at("10:01:05"))` and expects the entry `2026-11-10T10:04:00Z` to be pruned. Design decision 4 (and the server) keep minutes from `m0 - 7 days`, where `m0` is `now` truncated to the minute. Here `m0 = 2026-11-17T10:01Z`, so the bound is `2026-11-10T10:01Z` and `10:04` on the 10th is still inside the window. `queue.test.ts` and `sender.test.ts` use `NOW = 10:05:30` and `10:04` is correctly outside there.

Suggested fix: use `at("10:05:05")` (or an `old` entry at `2026-11-10T10:00:00Z`). The implementation follows the design and the other pruning tests pass.

## What changed

- `lib/config.ts`, `browser-info.ts`, `storage.ts`, `pairing.ts`, `queue.ts`, `sender.ts`, `controller.ts` implemented as in `design.md`; `apps/extension/.env.example` added.
- `entrypoints/background.ts` wires tabs, windows, idle, alarms and the `pair` message to one controller (one serialized chain; the OS name is read once at startup). `entrypoints/options/*` has the code input, Connect button and status/error text.
- Docs: `docs/architecture.md` flows 2 and 3, `docs/human-setup.md` (`WXT_API_BASE_URL`, name only).

## Verification

Each scenario is covered by the committed unit tests (`config`, `browser-info`, `pairing`, `queue`, `sender`, `controller`). 286 of 287 tests pass; the one failure is the test above. Typecheck, lint and `npm run build` pass.

## For the human to check

- Set `WXT_API_BASE_URL` in the environment that builds the extension zip. Background and options wiring is not unit-tested; try a real pairing in a browser.
- Privacy: only domain, seconds, browser and extension version are sent; the tracker reduces URLs to the registrable domain before storage.
