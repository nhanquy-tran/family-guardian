Depends on: none
Touches: ci-coverage

## Why
The 19 Nov 2026 test health report found no coverage measurement: a PR can delete tests or add untested code and nothing notices. We want coverage per area measured in CI, a ratchet that fails a PR lowering an area, and the numbers in the factory evidence comment.

## What changes
- Dev dependency `@vitest/coverage-v8` (same major as `vitest`); a coverage run of the existing vitest suite (v8, line coverage).
- `.github/scripts/coverage-areas.mjs` maps source files to five areas: shared, web lib, web pages and actions, API routes, extension.
- `.github/coverage-baseline.json` holds the line coverage percentage per area; `.github/scripts/coverage-ratchet.mjs` compares a run with it.
- New CI job `coverage` on pull requests runs the ratchet; `refresh-evidence.mjs` adds a per-area coverage row to the factory evidence.
- ADR 0023 records the choice.

## Out of scope
- Branch, function or statement thresholds; per-file thresholds; coverage for `e2e/`, `supabase/tests` or `.github/scripts`.
- Uploading to an external coverage service or posting a separate PR comment.
- Raising coverage or writing new product tests.
- Automatic raising of the baseline (a human or the developer commits the new numbers).
