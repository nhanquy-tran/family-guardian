## ADDED Requirements

### Requirement: Local day boundaries

The system SHALL compute day boundaries and the local day of a minute in a given IANA timezone, including daylight-saving days. Tests live in `packages/shared/src/usage-summary.test.ts`.

#### Scenario: Day range in a fixed offset zone
- **GIVEN** day `2026-03-10` and timezone `Asia/Ho_Chi_Minh` (UTC+7)
- **WHEN** `dayRangeUtc` is called
- **THEN** it returns start `2026-03-09T17:00:00.000Z` and end `2026-03-10T17:00:00.000Z`

#### Scenario: Daylight-saving day is 23 hours
- **GIVEN** day `2026-03-08` and timezone `America/New_York`
- **WHEN** `dayRangeUtc` is called
- **THEN** end minus start is 23 hours

#### Scenario: Late UTC minute belongs to next local day
- **GIVEN** minute `2026-03-10T18:30:00Z` and timezone `Asia/Ho_Chi_Minh`
- **WHEN** `localDay` is called
- **THEN** it returns `2026-03-11`

### Requirement: Today overview

`summarizeDay` SHALL take the aggregated rows and return total seconds, the top 10 domains by seconds with their share of the total (whole percent), and seconds per category using `categorize`. Tests live in `packages/shared/src/usage-summary.test.ts`.

#### Scenario: Totals and categories
- **GIVEN** 600 s on `youtube.com` and 300 s on `khanacademy.org`
- **WHEN** `summarizeDay` is called
- **THEN** totalSeconds is 900, byCategory.entertainment is 600, byCategory.education is 300, and top sites are youtube.com 67 % then khanacademy.org 33 %

#### Scenario: Only ten sites
- **GIVEN** entries for 12 distinct domains
- **WHEN** `summarizeDay` is called
- **THEN** topSites has 10 entries ordered by seconds descending

#### Scenario: Empty day
- **GIVEN** no entries
- **WHEN** `summarizeDay` is called
- **THEN** totalSeconds is 0, topSites is empty and every category is 0

### Requirement: Week view

`summarizeWeek` SHALL return the 7 local days ending at the given day (oldest first), each with seconds per category, plus the top 10 sites over the whole week. Tests live in `packages/shared/src/usage-summary.test.ts`.

#### Scenario: Seven days with gaps
- **GIVEN** entries on only two of the last seven days
- **WHEN** `summarizeWeek` is called
- **THEN** it returns 7 days in ascending date order and the other five have totalSeconds 0

#### Scenario: Days split by timezone
- **GIVEN** a minute at `2026-03-10T18:30:00Z` and timezone `Asia/Ho_Chi_Minh`
- **WHEN** `summarizeWeek` is called with last day `2026-03-11`
- **THEN** its seconds are counted on `2026-03-11`

#### Scenario: Week top sites
- **GIVEN** `youtube.com` appears on three days
- **WHEN** `summarizeWeek` is called
- **THEN** weekly topSites sums its seconds across the days

### Requirement: Day timeline

`buildTimeline` SHALL return, for each minute of the local day that has usage, the minute of day (0–1439 in the timezone) and the category with the most seconds in that minute (ties resolved by `CATEGORIES` order). Tests live in `packages/shared/src/usage-summary.test.ts`.

#### Scenario: Dominant category per minute
- **GIVEN** one minute row with domains `youtube.com` (40 s) and `khanacademy.org` (20 s)
- **WHEN** `buildTimeline` is called
- **THEN** that minute is `entertainment`

#### Scenario: Minute of day is local
- **GIVEN** minute `2026-03-10T01:05:00Z` and timezone `Asia/Ho_Chi_Minh`
- **WHEN** `buildTimeline` is called for `2026-03-10`
- **THEN** the slot has minuteOfDay 485 (08:05)

### Requirement: Timezone parameter

The page SHALL use the `tz` query parameter as the parent's timezone and SHALL fall back to `UTC` when it is missing or not a valid IANA name. The timezone SHALL NOT be stored or logged. Tests live in `packages/shared/src/usage-summary.test.ts`.

#### Scenario: Valid timezone
- **GIVEN** `tz=Asia/Ho_Chi_Minh`
- **WHEN** `resolveTimezone` is called
- **THEN** it returns `Asia/Ho_Chi_Minh`

#### Scenario: Invalid or missing timezone
- **GIVEN** `tz=Mars/Base` or no value
- **WHEN** `resolveTimezone` is called
- **THEN** it returns `UTC`

### Requirement: Database aggregation

The system SHALL aggregate usage in SQL functions `usage_by_day(child_id, tz, days)` and `usage_timeline(child_id, tz, day)` in a new migration. Both SHALL be `security invoker` with `set search_path = ''`, so RLS applies, SHALL validate `tz` against `pg_timezone_names`, and SHALL not be executable by `anon`. Tests live in `supabase/tests/usage.test.ts` (PGlite harness).

#### Scenario: Week with more than 1000 rows sums correctly
- **GIVEN** a child with 2500 `usage_minutes` rows over 7 local days across several domains
- **WHEN** a parent of that family calls `usage_by_day(child, 'UTC', 7)`
- **THEN** the sum of `seconds` equals the sum of the inserted seconds and no domain total is missing

#### Scenario: Days split by timezone in SQL
- **GIVEN** a minute at `2026-03-10T18:30:00Z`
- **WHEN** `usage_by_day` is called with `Asia/Ho_Chi_Minh`
- **THEN** the seconds are on day `2026-03-11`

#### Scenario: Timeline returns one row per minute
- **GIVEN** 1440 minutes of data on one day, two domains in some minutes
- **WHEN** `usage_timeline` is called for that day
- **THEN** it returns 1440 rows with `minute_of_day` 0 to 1439 and the domain and seconds arrays of each minute

#### Scenario: Other family's child
- **GIVEN** a child of another family
- **WHEN** a parent calls either function with that child id
- **THEN** zero rows are returned

#### Scenario: Invalid timezone
- **GIVEN** `tz` is `Mars/Base`
- **WHEN** either function is called
- **THEN** it raises `invalid_timezone`

#### Scenario: Days out of range
- **GIVEN** `days` is 0 or 32
- **WHEN** `usage_by_day` is called
- **THEN** it raises an error

#### Scenario: Anonymous caller
- **GIVEN** the `anon` role
- **WHEN** either function is called
- **THEN** permission is denied

### Requirement: Usage data loading and access

The page `/dashboard/usage/[childId]` SHALL load usage only through the signed-in parent's session client (RLS) and the SQL functions, SHALL read in explicit ranges until a short page, and SHALL show an error instead of partial numbers if any data call fails. Tests live in `apps/web/src/lib/usage.test.ts`.

#### Scenario: Child of another family
- **GIVEN** a child id that RLS does not return for the parent
- **WHEN** the usage data is requested
- **THEN** the result is "not found" and no function is called

#### Scenario: More than 1000 rows
- **GIVEN** the client returns 1000 rows then 250 rows for ranges 0-999 and 1000-1999
- **WHEN** `loadUsage` is called
- **THEN** all 1250 entries are returned

#### Scenario: Child lookup failure
- **GIVEN** the child select returns an error
- **WHEN** `loadUsage` is called
- **THEN** it returns an error result (not "not found") and no function is called

#### Scenario: Aggregation call failure
- **GIVEN** the `usage_by_day` or `usage_timeline` call returns an error
- **WHEN** `loadUsage` is called
- **THEN** it returns an error result with no entries

#### Scenario: Failure on a later page
- **GIVEN** the first page returns 1000 rows and the second page returns an error
- **WHEN** `loadUsage` is called
- **THEN** it returns an error result and none of the first page's rows

#### Scenario: Error state shown
- **GIVEN** an error result
- **WHEN** the page renders
- **THEN** it shows "Could not load usage. Try again." and no totals, sites, bars or strip

#### Scenario: Unauthenticated parent
- **GIVEN** no session
- **WHEN** the page is requested
- **THEN** the parent is redirected to `/login` by the existing dashboard layout guard (checked manually; no new code)

### Requirement: Presentation

Today SHALL show total active time, top sites with time and share, time per category and the minute strip. Week SHALL show a stacked bar per day by category and the top sites. Every colour SHALL have a text label. The layout SHALL work at 375 px width without horizontal scrolling. Tests live in `apps/web/src/lib/usage.test.ts`.

#### Scenario: Duration formatting
- **GIVEN** 3900 s and 420 s
- **WHEN** `formatDuration` is called
- **THEN** it returns `1 h 05 min` and `7 min`

#### Scenario: Bar segments
- **GIVEN** a day with 600 s entertainment and 300 s education, and a week maximum of 1800 s
- **WHEN** `barSegments` is called
- **THEN** the widths are 33.3 % and 16.7 % of the bar, in `CATEGORIES` order

#### Scenario: Phone layout (manual check)
- **GIVEN** the preview deployment and a viewport of 375 px
- **WHEN** the Today and Week views are opened
- **THEN** there is no horizontal scrollbar and all labels are readable; the PR records this check
