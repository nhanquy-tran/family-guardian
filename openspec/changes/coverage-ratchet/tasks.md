## 1. Tests (written first)
- [ ] 1.1 `tools/coverage/coverage-ratchet.test.ts`: areas, summary, compare, update, evidence row, fail-closed cases
- [ ] 1.2 `tools/coverage/coverage-wiring.test.ts`: dependency, vitest coverage config, CI job, evidence wiring

## 2. Tooling
- [ ] 2.1 Add `@vitest/coverage-v8` (same major as vitest) to root devDependencies; configure `coverage` in `vitest.config.ts` and add `tools/**/*.test.ts` to its `include`
- [ ] 2.2 `.github/scripts/coverage-areas.mjs` and `.github/scripts/coverage-ratchet.mjs` (`check`, `update`, exported pure functions)
- [ ] 2.3 Generate and commit `.github/coverage-baseline.json`

## 3. CI and evidence
- [ ] 3.1 `ci.yml`: job `coverage` on pull requests
- [ ] 3.2 `refresh-evidence.mjs`: per-area coverage row
- [ ] 3.3 Move `docs/decisions/0023-coverage-ratchet.md` status to accepted after merge
