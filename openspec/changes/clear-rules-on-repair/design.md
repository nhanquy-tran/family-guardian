## Decisions
- `PairDeps` gets an optional `dnr?: Dnr` (the existing interface in `rules.ts`). The controller passes `deps.dnr`; when it is absent, pairing skips the rule clearing (as other controller `dnr` uses do).
- Order on `200`: (1) remove `rulesVersion` in its own store call; (2) clear all dynamic rules in one `updateDynamicRules` call (`removeRuleIds` = every id from `getDynamicRules()`, including 2000000; `addRules: []`, because the `Dnr` interface requires `addRules`); (3) remove the other stored keys (now including `rulesDomains`); (4) write `browser` and `deviceToken`. Removing `rulesVersion` first matters: an unchanged server `rulesVersion` makes the heartbeat skip `syncRules` (`controller.ts:170-171`) and `evaluateLimits` return early when `limitBlocked` is unchanged (`controller.ts:192`), so after a partial failure the old child's rules would never be rebuilt.
- Any failure after step 1 returns `failed` with the old token still stored. With `rulesVersion` gone, the next alarm does a full resync with the old token and rebuilds the old child's rules, so a partial failure never leaves the device unblocked.
- The new child's rules come from the next alarm: no `rulesVersion` is stored, so the sync runs.

## Data model
None. Local extension storage only, no new keys.

## Contracts
None. No shared type, device API or manifest change.

## Failure modes
- Removing `rulesVersion` rejects: `{ ok: false, reason: "failed" }`, nothing changed.
- `getDynamicRules` or `updateDynamicRules` rejects: `failed`; the old token and other keys stay, `rulesVersion` is absent, so the next alarm resyncs and rebuilds the rules.
- A store write rejects after the rules were cleared: `failed`, no throw; the next alarm resyncs with the old token and rebuilds the old child's rules.

## Alternatives
Clearing the rules in the controller after `pair` returns: rejected, because the issue asks for the same step as storing the token and a gap would reopen the stale window.

## ADR impact
None. Follows ADR 0005 (no new data sent).
