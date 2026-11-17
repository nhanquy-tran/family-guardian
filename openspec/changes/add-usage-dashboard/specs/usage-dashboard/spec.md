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

`summarizeDay` SHALL return total seconds, the top 10 domains by seconds with their share of the total (whole percent), and seconds per category using `categorize`. Tests live in `packages/shared/src/usage-summary.test.ts`.

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
- **GIVEN** in one minute 40 s on `youtube.com` and 20 s on `khanacademy.org`
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

### Requirement: Usage data loading and access

The page `/dashboard/usage/[childId]` SHALL load usage only through the signed-in parent's session client (RLS), SHALL page past 1000 rows, and SHALL show an error instead of partial numbers if loading fails. Tests live in `apps/web/src/lib/usage.test.ts`.

#### Scenario: Child of another family
- **GIVEN** a child id that RLS does not return for the parent
- **WHEN** the usage data is requested
- **THEN** the result is "not found" and no usage query runs

#### Scenario: More than 1000 rows
- **GIVEN** the client returns 1000 rows then 250 rows
- **WHEN** `loadUsage` is called
- **THEN** all 1250 entries are returned

#### Scenario: Query failure
- **GIVEN** the usage query returns an error
- **WHEN** `loadUsage` is called
- **THEN** it returns an error result with no entries

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
