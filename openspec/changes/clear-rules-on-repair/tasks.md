## Tests
- [ ] 1.1 Write tests for every scenario in the delta specs (`apps/extension/lib/pairing.test.ts`, `controller.test.ts`).

## Extension
- [ ] 2.1 Add optional `dnr` to `PairDeps`; in `pairWithCode` clear all dynamic rules, then remove the keys plus `rulesDomains`, then store the token.
- [ ] 2.2 Pass `deps.dnr` from `controller.pair`.
