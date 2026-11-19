## MODIFIED Requirements

### Requirement: Limits are validated and saved fail-closed
`saveDailyLimits(client, childId, values)` SHALL take a map of category to raw input (trimmed first; empty after trimming = no limit), reject the whole save before any write on an unknown category or a trimmed value that does not match `^\d+$` or is not from 5 to 1440, and otherwise upsert the set values and delete the cleared ones. Any store error SHALL return `{ ok: false, error: "failed" }`. `listDailyLimits` SHALL return limits in category order, or a failed result on error.

#### Scenario: Valid values are upserted
File: `apps/web/src/lib/daily-limits.test.ts`
- **WHEN** `saveDailyLimits(client, childId, { games: "60", entertainment: " 90 ", news: "" })` is called
- **THEN** the fake client receives one upsert into `child_category_limits` with `[{ child_id, category: "games", minutes_per_day: 60 }, { child_id, category: "entertainment", minutes_per_day: 90 }]` and conflict target `child_id,category`
- **AND** one delete filtered by `child_id = childId` and `category in ("news")`
- **AND** the result is `{ ok: true }`

#### Scenario: Invalid minutes write nothing
File: `apps/web/src/lib/daily-limits.test.ts`
- **WHEN** `saveDailyLimits` is called with `games` set to `"4"`, `"1441"`, `"abc"`, `"1.5"` and `"-10"` (one call each), with one valid value in the same map
- **THEN** each result is `{ ok: false, error: "invalid_minutes" }` and the fake client receives no upsert and no delete

#### Scenario: Unknown category writes nothing
File: `apps/web/src/lib/daily-limits.test.ts`
- **WHEN** `saveDailyLimits(client, childId, { music: "30" })` is called
- **THEN** the result is `{ ok: false, error: "invalid_category" }` and nothing is written

#### Scenario: All empty clears the limits
File: `apps/web/src/lib/daily-limits.test.ts`
- **GIVEN** the fake client finds the child
- **WHEN** `saveDailyLimits` is called with every category set to `""`
- **THEN** no upsert is made, one delete covers all 9 categories, and the result is `{ ok: true }`

#### Scenario: Store failure returns an error code
File: `apps/web/src/lib/daily-limits.test.ts`
- **GIVEN** the fake client returns an error on upsert, then on delete, then throws
- **WHEN** `saveDailyLimits` is called with valid values (one run each)
- **THEN** each result is `{ ok: false, error: "failed" }` and none throws

#### Scenario: List in category order
File: `apps/web/src/lib/daily-limits.test.ts`
- **GIVEN** the fake client returns limits `news 30`, `games 60`, `education 120`
- **WHEN** `listDailyLimits(client, childId)` is called
- **THEN** it filters by `child_id = childId` and returns them in the order `education`, `games`, `news` with `minutesPerDay` values

#### Scenario: List failure is not an empty list
File: `apps/web/src/lib/daily-limits.test.ts`
- **GIVEN** the fake client returns an error, and in another run throws
- **WHEN** `listDailyLimits` is called
- **THEN** the result is `{ ok: false, error: "failed" }`

## ADDED Requirements

### Requirement: Clearing limits checks the child is visible
When `saveDailyLimits` sets no value, it SHALL first read the child by id (RLS-scoped) and return `{ ok: false, error: "not_found" }` without writing when the child is not visible, because a delete that matches no limit is a normal success. The daily-limits card SHALL show "This child was not found. Reload the page and try again." for `not_found`.

#### Scenario: Clearing limits of a child the parent cannot see
File: `apps/web/src/lib/daily-limits.test.ts`
- **GIVEN** the fake client's `children` read returns no row
- **WHEN** `saveDailyLimits` is called with every category set to `""`
- **THEN** the result is `{ ok: false, error: "not_found" }` and no delete is made
- **AND** `DailyLimitsCard` with `error="not_found"` shows "This child was not found. Reload the page and try again."
