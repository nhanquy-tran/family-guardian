## Summary
`pairWithCode` (apps/extension/lib/pairing.ts) now, after the server accepts the code: removes `rulesVersion`, clears all dynamic DNR rules (`addRules: []`) via the optional `deps.dnr`, removes the other keys including `rulesDomains`, then stores `browser` and `deviceToken`. `controller.pair` passes `deps.dnr`.
Scenarios are verified by `pairing.test.ts` (re-pair, rules-removal failure, invalid code) and `controller.test.ts` (new child's rules, stale domains, store failure then resync, dnr forwarding).

## Docs to update
- `docs/architecture.md`: re-pairing clears the previous child's rules and rule state.
