# Notes

## Test concerns

Implementation is done for all tasks except where these tests block it. I did not work around them.

1. `packages/shared/src/contracts.test.ts` "New fields parse and are bounded" (line 78) expects `RulesResponse.parse(ok)` to `toEqual(ok)` where `ok` has no `categoryOverrides`. The same file's "Older body still parses" (line 99) and the design and spec require `categoryOverrides` to default to `{}`. Both cannot hold: the `{}` default shows up in the parsed object, so line 78 fails. The old #86 assertion needs `categoryOverrides: {}` in `ok` (or `{ ...ok, categoryOverrides: {} }` on the right).

2. `apps/extension/lib/controller.test.ts` "controller limit enforcement" tests "Limit reached blocks the category", "Works offline", "Survives a restart" and "DNR failure retries" call `track(... "10:00:00")` and then a single `onAlarm` at 10:04:05 or 10:06:05. `tracker.ts` credits no time across a gap above `MAX_GAP_MS` (120 s), so the tracker yields no entries and no usage is counted (verified: `takeCompletedEntries` returned `[]`). The tests need alarms every minute (as "offline minutes are queued" does), or the tracker's gap rule would have to change, which is outside this change and would affect tracker tests.

3. Same file, "Reset at midnight in the family timezone": the stored `limitBlocked` fixture is `{ "roblox.com": "games" }`, but with games over the limit the spec'd domain set is every seed games domain plus overrides and seen domains. At 16:59:30 the computed set differs from the fixture, so one DNR update happens where the test expects none (`updates` length 0). The fixture should hold the full computed set, or the test should assert on the content instead.

## Docs to update

- `docs/architecture.md`: extension keeps per-category usage and limit blocks in `chrome.storage.local` (`limitUsage`, `limitBlocked`, `rulesLimits`, `rulesTimezone`, `rulesOverrides`); rules API returns `categoryOverrides`.
- `docs/platform-notes.md`: the tracker credits no time across a gap over 120 s, so tests of time-based features need an alarm at least every 2 minutes.

## Summary

- `RulesResponse.categoryOverrides` (default `{}`, keys at most 253 chars, at most `MAX_RULE_DOMAINS`); `handleRules` returns the merged map, family rows first when capped.
- Extension `lib/limits.ts`: `dayKey`, `addUsage`, `overLimitCategories`, `limitBlockDomains`, `buildLimitRules`, plus helpers `evaluateLimitBlocks`, `readUsage`, `readLimits`, `readOverrides`.
- `syncRules` stores limits, timezone, overrides and `limitBlocked`, and applies limit rules after the manual ones. `applyRules` takes optional limit blocks.
- Controller: counts usage in `alarmNormal`, re-evaluates after sync, applies rules only when the set changes, `recordBlocked` accepts limit-blocked domains. Re-pairing clears the new keys.
- Block page: `describeBlock` and `blocked/main.ts` set the heading.
- Verified by the tests in `limits.test.ts`, `rules.test.ts`, `pairing.test.ts`, `blocked.test.ts` and the web and shared tests (all green except the six tests listed above).

## Debugging

All six failures were wrong test data; the code matches the spec. Reproduced with `npx vitest run apps/extension/lib/controller.test.ts packages/shared/src/contracts.test.ts`.

1. `contracts.test.ts` "New fields parse and are bounded". Root cause: `RulesResponse` defaults `categoryOverrides` to `{}` (spec "Older body still parses"), so the parsed object has that key. Evidence: the received diff shows only `"categoryOverrides": {}` extra. Verdict: **test**. Change: one assertion, expected is now `{ ...ok, categoryOverrides: {} }`.
2. `controller.test.ts` "Limit reached blocks the category", "Works offline", "Survives a restart", "DNR failure retries". Root cause: `tracker.ts:53` credits no time across a gap above `MAX_GAP_MS` (120 s); the tests made one alarm six minutes after the tab event, so no usage was counted. Evidence: `rules()` empty. Real alarms run every minute. Verdict: **test**. Change: added an `alarms(controller, from, to)` helper that fires an alarm at `10:MM:05` per minute, used in place of the single alarm. "Survives a restart" alarms 1-4 on the first controller (240 s) then 5-6 on the new one (360 s). "DNR failure retries": the limit is reached at 10:05:05 where the first update fails (asserts no `limitBlocked`), then 10:06:05 succeeds.
3. `controller.test.ts` "Reset at midnight in the family timezone". Root cause: fixture `limitBlocked: { "roblox.com": "games" }` is not the set the spec computes for an over-limit games category (all seed games domains), so the code correctly applied one DNR update. Verdict: **test**. Change: fixture and assertion use `limitBlockDomains(["games"], {}, {}, [])`.

Code change: whitespace only on `controller.ts:115` (two statements on one line split). No spec question.
