## ADDED Requirements

### Requirement: Time format
`formatLocalTime(iso, timeZone)` (`apps/web/src/lib/time/local-time.ts`) SHALL return `D Mon, HH:MM <zone>` in 24-hour time with the `en-GB` short zone name, and SHALL read a missing or invalid timezone as `UTC`.

#### Scenario: Formatting in a timezone
File: `apps/web/src/lib/time/local-time.test.ts`
- **GIVEN** `2026-11-21T10:40:00.000Z`
- **WHEN** `formatLocalTime` runs with `Asia/Ho_Chi_Minh`, `UTC`, `Not/AZone` and an empty string
- **THEN** it returns `21 Nov, 17:40 GMT+7`, `21 Nov, 10:40 UTC`, `21 Nov, 10:40 UTC` and `21 Nov, 10:40 UTC`

#### Scenario: Date changes across midnight
File: `apps/web/src/lib/time/local-time.test.ts`
- **GIVEN** `2026-11-21T20:30:00.000Z`
- **WHEN** `formatLocalTime` runs with `Asia/Ho_Chi_Minh`
- **THEN** it returns `22 Nov, 03:30 GMT+7`

### Requirement: Absolute times in the parent's timezone
Every absolute date-time on the parent dashboard SHALL be rendered by `LocalTime` (`apps/web/src/components/local-time.tsx`) as `<time dateTime="<iso>">` with `formatLocalTime(iso, timeZone)`, where `timeZone` is the browser's timezone on the client and `UTC` in the server render. The offline banner ("has not reported since") and the pairing-code expiry ("Valid until") SHALL use it.

#### Scenario: Server render and browser timezone
File: `apps/web/src/components/local-time.test.ts`
- **GIVEN** `LocalTime` with `iso` `2026-11-21T10:40:00.000Z`
- **WHEN** it is rendered with `react-dom/server`, and its client snapshot is read with the browser timezone `Asia/Ho_Chi_Minh`
- **THEN** the markup is `<time dateTime="2026-11-21T10:40:00.000Z">21 Nov, 10:40 UTC</time>` and the client timezone is `Asia/Ho_Chi_Minh`

#### Scenario: Banner and pairing code use LocalTime
File: `apps/web/src/components/local-time.test.ts`
- **GIVEN** `OfflineBannerView` with one offline alert whose `incident_last_seen_at` is `2026-11-21T10:40:00.000Z`, and `ChildrenList` with an active code expiring at `2026-11-17T11:00:00.000Z`
- **WHEN** they are rendered with `react-dom/server`
- **THEN** the banner contains `since <time dateTime="2026-11-21T10:40:00.000Z">` and the children list contains `Valid until <time dateTime="2026-11-17T11:00:00.000Z">`, and neither contains `T10:40:00.000Z<` or `T11:00:00.000Z<` as text
