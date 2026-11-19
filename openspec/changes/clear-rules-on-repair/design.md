## Decisions
- `PairDeps` gets an optional `dnr?: Dnr` (the existing interface in `rules.ts`). The controller passes `deps.dnr`; when it is absent, pairing skips the rule clearing (as other controller `dnr` uses do).
- Order on `200`: clear all dynamic rules in one `updateDynamicRules` call (`removeRuleIds` = every id from `getDynamicRules()`, including 2000000; no `addRules`), then remove the stored keys (now including `rulesDomains`), then write `browser` and `deviceToken`. Rules are cleared first so the new token is never stored beside the old child's rules.
- A DNR failure returns `failed` before any store change: the old token, data and rules stay. A store failure after the rules were cleared also returns `failed`; the old child's rules are then gone while the old token stays. Accepted: the next successful sync rebuilds them.
- The new child's rules come from the next alarm: no `rulesVersion` is stored, so the sync runs.

## Data model
None. Local extension storage only, no new keys.

## Contracts
None. No shared type, device API or manifest change.

## Failure modes
- `getDynamicRules` or `updateDynamicRules` rejects: `{ ok: false, reason: "failed" }`, nothing changed.
- Store write rejects: `failed`, no throw.

## Alternatives
Clearing the rules in the controller after `pair` returns: rejected, because the issue asks for the same step as storing the token and a gap would reopen the stale window.

## ADR impact
None. Follows ADR 0005 (no new data sent).
