# 0023. Coverage ratchet in CI

Date: 2026-11-19. Status: proposed (spec of #156).

## Context
The test health report of 19 Nov 2026 found that coverage is not measured: a PR can remove tests or add untested code unnoticed.

## Decision
Measure line coverage with `@vitest/coverage-v8` (dev dependency, same major as vitest) over the existing suite, grouped into five areas (shared, web lib, web pages and actions, API routes, extension). `.github/coverage-baseline.json` holds one percentage per area; a separate CI job `coverage` fails a PR that lowers an area by more than 0.1 points, and the factory evidence shows the per-area numbers. Lowering the baseline needs an explicit edit in the PR. No external service; the baseline holds numbers only, no user data.

## Consequences
- One extra parallel CI job (a second test run, no model cost).
- Coverage can only go up unless a reviewer accepts a baseline edit.
- Revisit thresholds (branch coverage, per-file) after a month of data.
