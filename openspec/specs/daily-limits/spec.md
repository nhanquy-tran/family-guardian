# daily-limits Specification

## Purpose
Parents set a daily time limit in minutes per category for each child; the limits are stored under family-scoped RLS, bump the child's rules version and reach devices through the rules API together with the family timezone.

## Requirements

### Requirement: Limits are stored per child and category
The database SHALL have `child_category_limits (child_id, category, minutes_per_day)` with primary key `(child_id, category)`, `category` one of the 9 categories, `minutes_per_day` an integer from 5 to 1440, and rows deleted when the child is deleted. The table SHALL have RLS limiting parents to their own family's children. Insert, update and delete SHALL bump the child's `rules_version` through the existing `bump_rules_version()` trigger function.

#### Scenario: Value constraints
File: `supabase/tests/daily-limits.test.ts`
- **WHEN** the service role inserts limits with minutes `4`, `1441`, category `music`, and a second row for the same `(child_id, category)`
- **THEN** each insert fails (check or unique violation)
- **AND** minutes `5` and `1440` for `games` and `news` succeed

#### Scenario: Cascade on child delete
File: `supabase/tests/daily-limits.test.ts`
- **GIVEN** a child with two limits
- **WHEN** the child is deleted
- **THEN** no limit rows remain for that child

#### Scenario: Parent sees and writes only own family
File: `supabase/tests/daily-limits.test.ts`
- **GIVEN** limits for family B's child
- **WHEN** parent A selects, updates, deletes and inserts limits for family B's child
- **THEN** the select returns no rows, update and delete affect zero rows, and the insert fails with an RLS violation
- **AND** parent A can insert, update and delete limits for their own child

#### Scenario: Changes bump rules_version
File: `supabase/tests/daily-limits.test.ts`
- **GIVEN** a child with `rules_version` `0`
- **WHEN** a limit is inserted, then updated, then deleted
- **THEN** `rules_version` is `1` after the insert, `3` after the update (the shared trigger bumps the old and the new child) and `4` after the delete
- **AND** another child's `rules_version` is unchanged

### Requirement: Timezone change reaches devices
The migration SHALL add an `after update of timezone on public.families` trigger that bumps `rules_version` of every child of the family when `old.timezone is distinct from new.timezone`, so devices refetch the rules and reset limits at the right midnight.

#### Scenario: Timezone change bumps the family's children
File: `supabase/tests/daily-limits.test.ts`
- **GIVEN** two children of family A at `rules_version` `0` and a child of family B
- **WHEN** family A's timezone changes from `UTC` to `Asia/Tokyo`, then is saved unchanged
- **THEN** both A children are at `1` after each step and B's child stays at `0`

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

### Requirement: Daily limits card on the rules page
The rules page SHALL render a "Daily limits" card (`DailyLimitsCard`) with one minutes input per category (all 9, in list order), prefilled with the saved value or empty, a save button submitting to a server action, and a readable message for an error code. The card SHALL use only the classes exported by `ui.ts`. The server action SHALL read the `limit_<category>` fields, call `saveDailyLimits` with the session client, and on any error redirect with the error code instead of saving.

#### Scenario: Inputs for every category
File: `apps/web/src/components/daily-limits-card.test.ts`
- **WHEN** `DailyLimitsCard` renders with limits `games 60`
- **THEN** the markup contains `Daily limits`, 9 number inputs named `limit_<category>` with `min="5"` and `max="1440"`, the `games` input has value `60` and the other 8 have no value, and a hidden `childId` input

#### Scenario: Error messages
File: `apps/web/src/components/daily-limits-card.test.ts`
- **WHEN** `DailyLimitsCard` renders with error `invalid_minutes` and, in another run, `failed`
- **THEN** the markup has an alert mentioning `5` and `1440`, and an alert saying the limits could not be loaded or saved

#### Scenario: Only ui.ts styles
File: `apps/web/src/components/daily-limits-card.test.ts`
- **WHEN** `DailyLimitsCard` renders
- **THEN** the markup contains the `card` and `buttonPrimary` class strings from `ui.ts` and no raw palette class (`bg-blue-`, `text-gray-`, hex colour)

### Requirement: Rules contract carries limits and timezone
`RulesResponse` SHALL accept `limits` (an array of at most 9 `{ category, minutesPerDay }` with a known category and an integer from 5 to 1440, default `[]`), an optional non-empty `timezone` string of at most 64 characters, and `categoryOverrides` (a map of domain string, at most 253 characters, to known category with at most `MAX_RULE_DOMAINS` entries, default `{}`). `limits` SHALL NOT contain the same category twice. A body without the new fields SHALL still parse, and unknown fields SHALL be stripped.

#### Scenario: New fields parse and are bounded
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `RulesResponse` parses a body with `limits: [{ category: "games", minutesPerDay: 60 }]` and `timezone: "Asia/Ho_Chi_Minh"`
- **THEN** it parses unchanged
- **AND** a limit with category `music`, with `minutesPerDay` `4`, `1441` or `1.5`, an empty `timezone`, a 65-character `timezone`, and 10 limits each fail to parse

#### Scenario: Duplicate categories rejected
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `RulesResponse` parses `limits` with `games 60` twice
- **THEN** it fails to parse

#### Scenario: Older body still parses
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `RulesResponse` parses `{ rulesVersion: 1, domains: [], truncated: false }`
- **THEN** it parses with `limits` equal to `[]`, `categoryOverrides` equal to `{}` and no `timezone`

#### Scenario: Category overrides are bounded
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `RulesResponse` parses `categoryOverrides: { "youtube.com": "education" }`, then a map with category `music`, a map with a 254-character key, and a map with 5001 entries
- **THEN** the first parses unchanged and the other three fail to parse

### Requirement: Rules store reads limits and timezone
The Supabase rules store SHALL return the family's `timezone` from `findChild` and the child's limits from `listLimits(childId)`, and SHALL throw on a database error so the endpoint fails closed.

#### Scenario: Store maps rows
File: `apps/web/src/lib/device/supabase-store.test.ts`
- **GIVEN** a fake client returning a device row whose child has `family_id`, `rules_version` `3` and family timezone `Asia/Ho_Chi_Minh`, and limit rows `{ category: "games", minutes_per_day: 60 }`
- **WHEN** `findChild` and `listLimits` are called
- **THEN** they return `timezone: "Asia/Ho_Chi_Minh"` and `[{ category: "games", minutesPerDay: 60 }]`, and `listLimits` filters by `child_id`

### Requirement: Rules API returns the merged category overrides
`GET /api/device/rules` SHALL return `categoryOverrides` as the merged global and family `domain_categories` map already built for `expandBlockRules` (family rows win), so devices categorize like the dashboard. When capping at `MAX_RULE_DOMAINS`, family rows SHALL come first. The existing `listCategoryOverrides` SHALL be reused; no new store method is added. This adds the field to the site-blocking "Rules API for devices" response.

#### Scenario: Merged rows, family wins, capped
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store with global rows `youtube.com entertainment`, `kidgame.com games` and family rows `youtube.com education`, `roblox.com games`
- **WHEN** `handleRules` runs
- **THEN** `categoryOverrides` is `{ "youtube.com": "education", "roblox.com": "games", "kidgame.com": "games" }`
- **AND** with 5001 merged rows `categoryOverrides` has 5000 entries and the family rows are among them
