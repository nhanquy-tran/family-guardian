## Tests
- [x] 1.1 Write tests for every scenario in the delta specs (`apps/extension/lib/pairing.test.ts`, `controller.test.ts`).

## Extension
- [x] 2.1 Add optional `dnr` to `PairDeps`; in `pairWithCode` remove `rulesVersion` first (own store call), then clear all dynamic rules (`addRules: []`), then remove the other keys plus `rulesDomains`, then store the token.
- [x] 2.2 Pass `deps.dnr` from `controller.pair`, with a `controller.test.ts` test showing that `controller.pair` forwards `deps.dnr` (re-pair through the controller clears the fake `dnr` rules).
