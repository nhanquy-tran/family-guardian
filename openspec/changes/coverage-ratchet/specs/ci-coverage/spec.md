## Purpose
Measure test coverage per area of the codebase in CI, stop pull requests that lower it, and show the numbers in the factory evidence.

## ADDED Requirements

### Requirement: Coverage areas
Source files SHALL belong to exactly one of five areas: shared, web lib, web pages and actions, API routes, extension. A covered file that matches no area MUST fail the coverage check.

#### Scenario: Files map to their area
- **GIVEN** files under `packages/shared/src`, `apps/web/src/lib`, `apps/web/src/app/api`, `apps/web/src/app/dashboard`, `apps/web/src/components` and `apps/extension/lib`
- **WHEN** each is classified
- **THEN** they are shared, web-lib, api-routes, web-pages, web-pages and extension
- File: `tools/coverage/coverage-ratchet.test.ts`

#### Scenario: API routes are not web pages
- **GIVEN** `apps/web/src/app/api/device/rules/route.ts`
- **WHEN** it is classified
- **THEN** it is api-routes, not web-pages
- File: `tools/coverage/coverage-ratchet.test.ts`

#### Scenario: A file outside every area fails
- **GIVEN** a covered file `tools/new/thing.ts` in the coverage summary
- **WHEN** the summary is grouped
- **THEN** the check fails and names that file
- File: `tools/coverage/coverage-ratchet.test.ts`

### Requirement: Coverage measurement
The repository SHALL measure line coverage of the existing vitest suite with `@vitest/coverage-v8` and compute one percentage per area from the summed covered and total lines of its files.

#### Scenario: Area percentage sums lines
- **GIVEN** two shared files with 8 of 10 and 2 of 10 lines covered
- **WHEN** the summary is computed
- **THEN** shared is 50.0 percent
- File: `tools/coverage/coverage-ratchet.test.ts`

#### Scenario: Test files are not measured
- **GIVEN** the vitest coverage configuration
- **WHEN** its include and exclude lists are read
- **THEN** test files are excluded and the five area directories are included
- File: `tools/coverage/coverage-wiring.test.ts`

#### Scenario: The coverage provider is a declared dependency
- **GIVEN** the root `package.json`
- **WHEN** its devDependencies are read
- **THEN** `@vitest/coverage-v8` is listed with the same major version as `vitest`
- File: `tools/coverage/coverage-wiring.test.ts`

### Requirement: Coverage ratchet
`.github/coverage-baseline.json` SHALL hold a line coverage percentage for every area. The ratchet MUST fail when an area is more than 0.1 percentage points below its baseline, and MUST fail closed when the baseline or the coverage summary is missing, malformed or lacks an area.

#### Scenario: Equal or higher coverage passes
- **GIVEN** a baseline of 80.0 for shared
- **WHEN** a run measures 80.0 or 85.0
- **THEN** the comparison passes for shared
- File: `tools/coverage/coverage-ratchet.test.ts`

#### Scenario: Lower coverage fails
- **GIVEN** a baseline of 80.0 for web-lib
- **WHEN** a run measures 79.0
- **THEN** the comparison fails and names web-lib, 79.0 and 80.0
- File: `tools/coverage/coverage-ratchet.test.ts`

#### Scenario: Rounding noise passes
- **GIVEN** a baseline of 80.0
- **WHEN** a run measures 79.95
- **THEN** the comparison passes
- File: `tools/coverage/coverage-ratchet.test.ts`

#### Scenario: Missing or malformed input fails closed
- **GIVEN** a missing baseline file, invalid JSON, a baseline without the extension area, or an area with no measured files
- **WHEN** the ratchet runs
- **THEN** it exits non-zero with a message and never reports a pass
- File: `tools/coverage/coverage-ratchet.test.ts`

#### Scenario: Update never lowers a number
- **GIVEN** a baseline of 80.0 for shared with a run of 78.0, and 70.0 for api-routes with a run of 75.0
- **WHEN** the baseline is updated
- **THEN** shared stays 80.0 and api-routes becomes 75.0
- File: `tools/coverage/coverage-ratchet.test.ts`

### Requirement: Coverage in CI
CI SHALL run the coverage ratchet in a job named `coverage` on every pull request, in addition to `npm run check`, and the job MUST fail when the ratchet fails.

#### Scenario: CI job exists
- **GIVEN** `.github/workflows/ci.yml`
- **WHEN** it is read
- **THEN** a `coverage` job runs on pull requests and executes the ratchet script
- File: `tools/coverage/coverage-wiring.test.ts`

### Requirement: Coverage in factory evidence
The factory evidence of a pull request SHALL include a row with the line coverage of each area next to its baseline, and MUST show `not run` instead of numbers when coverage could not be computed.

#### Scenario: Evidence row shows each area
- **GIVEN** measured coverage and a baseline for all five areas
- **WHEN** the evidence row is formatted
- **THEN** it reads `Coverage per area` with each area name, its percentage and its baseline
- File: `tools/coverage/coverage-ratchet.test.ts`

#### Scenario: Evidence row marks a drop
- **GIVEN** web-lib measured below its baseline
- **WHEN** the evidence row is formatted
- **THEN** the row says fail and names web-lib
- File: `tools/coverage/coverage-ratchet.test.ts`

#### Scenario: Evidence row when coverage did not run
- **GIVEN** no coverage summary
- **WHEN** the evidence row is formatted
- **THEN** it reads `Coverage per area` with `not run` and no percentages
- File: `tools/coverage/coverage-ratchet.test.ts`

#### Scenario: Evidence script uses the row
- **GIVEN** `.github/scripts/refresh-evidence.mjs`
- **WHEN** it is read
- **THEN** it imports the row formatter from `coverage-ratchet.mjs`
- File: `tools/coverage/coverage-wiring.test.ts`
