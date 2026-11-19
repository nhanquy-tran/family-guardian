## Decisions
- **Provider and metric**: `@vitest/coverage-v8`, line coverage only, reporter `json-summary`. The extension and web code already run in the one root vitest config, so one run covers every area.
- **Areas** (by path prefix, source files only, test files and `*.d.ts` excluded): `shared` = `packages/shared/src/`; `web-lib` = `apps/web/src/lib/`; `api-routes` = `apps/web/src/app/api/`; `web-pages` = the rest of `apps/web/src/app/` and `apps/web/src/components/`; `extension` = `apps/extension/lib/` and `apps/extension/entrypoints/`. Coverage `include` lists exactly those directories. A covered file matching no area is an error, so a new directory cannot escape the ratchet.
- **Baseline**: `.github/coverage-baseline.json`, `{ "<area>": <percent, one decimal> }`, committed on main. A PR fails when an area is below its baseline by more than 0.1 points (rounding tolerance). Lowering is allowed only by editing the baseline in the same PR, visible in review. `coverage-ratchet.mjs update` rewrites the baseline from a run and never lowers a number on its own.
- **Where it runs**: a separate CI job `coverage` on `pull_request` (parallel to `check`, so `npm run check` stays unchanged). `refresh-evidence.mjs` runs the same coverage and adds one row "Coverage per area" (`area current% (baseline%)`), since the evidence workflow already recomputes tests on every push. The first baseline is generated at build time with `update` and committed.
- **Fail closed**: missing or unparseable baseline or summary, an area without files, a baseline area with no measurement, or a failed vitest run all fail the job. Evidence shows `not run` instead of numbers in those cases, never `pass`.
- Pure functions (`areaOf`, `summarize`, `compare`, `formatRow`) are exported from `coverage-ratchet.mjs` so tests need no real coverage run.

## Data model
None. The baseline is a committed JSON file with five numbers, not user data.

## Contracts
No shared types, device API or extension change. The evidence row is added to the existing "Evidence (latest push)" table; other rows are unchanged.

## Failure modes
- Coverage run fails or the summary is missing: ratchet exits non-zero; evidence row says `not run`.
- Baseline missing, malformed or lacking an area: ratchet exits non-zero.
- File outside every area: non-zero exit naming the file.
- `gh pr edit` failure in the evidence script: unchanged (existing behaviour).

## Alternatives
- vitest `coverage.thresholds` in the config: simpler, but it cannot express "not lower than the committed baseline" per named area and feeds nothing to the evidence row. Not chosen.
- Compare with main's coverage by running the suite twice: doubles CI time. Not chosen.
- An external service (Codecov): new service, against rule 5. Not chosen.

## ADR impact
Adds ADR 0023 (coverage ratchet, new dev dependency). Follows 0006 and 0019 (factory CI cost: one extra parallel job, no model calls). No ADR changed.
