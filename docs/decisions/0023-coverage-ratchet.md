# 0023. Coverage minimums per area that only go up

Date: 2026-11-19. Status: accepted (owner approved 2026-11-19). Issue #156.

## Context
Line coverage is 79%, but nothing measured it, so a factory PR could add untested code without anyone noticing. The test health report of 19 Nov 2026 found most of the gap in one area: pages and server actions (`apps/web/src/app/**`) at 31% lines and 14% branches, while shared code is at 99%. A single global number would hide a drop in one area behind a gain in another.

## Decision
- **Tool**: `@vitest/coverage-v8`, the coverage provider for the test runner we already use. It is kept at the same version as `vitest`.
- **Areas**: minimums for lines and branches in `vitest.config.ts`, globally and for each area: `packages/shared/src`, `apps/web/src/lib`, `apps/web/src/components`, `apps/web/src/app`, `apps/extension`.
- **Ratchet**:
  - `npm run coverage` fails when an area falls below its minimum.
  - When coverage grows, Vitest's `autoUpdate` raises the minimum to the new whole percentage in `vitest.config.ts`. Whole numbers leave under one point of slack against noise.
  - The factory gate commits the raised numbers with the PR. A person running `npm run coverage` commits them too.
- **Where it runs**:
  - `npm run check:ci` (typecheck, lint, tests with coverage) runs in the required CI `check` job and in the factory gate.
  - `npm run check` stays without coverage for fast local runs.
  - The CI job summary and the factory evidence comment show coverage by area (`.github/scripts/coverage-table.mjs`).
- **Scope**: TypeScript only. SQL and RLS are covered by the PGlite tests, and screens by e2e; neither shows up in these numbers.

## Consequences
- The CI test step takes a few seconds longer, because coverage instruments the run.
- A PR that adds code without tests to an area can fail CI even though every test passes. The fix is a test, or, if the code really cannot be unit tested, a minimum lowered on purpose in the same PR, where the reviewer sees it.
- `vitest` and `@vitest/coverage-v8` must stay on the same version; Dependabot updates them together (the `vitest` group).
