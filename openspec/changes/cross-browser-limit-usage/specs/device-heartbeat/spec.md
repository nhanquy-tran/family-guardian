## ADDED Requirements

### Requirement: The heartbeat response carries the child's other devices' usage
A `200` response SHALL include `otherUsage` `{ day, seconds }`: today's date in the family timezone and today's seconds per category (domains mapped with the seed and family overrides) of the child's other devices, excluding the caller, with no domains. The SQL function `device_other_usage` SHALL compute it and be executable by `service_role` only. If it cannot be computed the response SHALL still be `200` without `otherUsage`.

#### Scenario: Other device seconds by category
File: `apps/web/src/lib/device/heartbeat.test.ts`
- **GIVEN** a valid token and a fake store whose `otherUsage` returns `{ day: "2026-11-17", seconds: { games: 600 } }`
- **WHEN** a valid body is sent
- **THEN** the response is `200` with `rulesVersion` `3` and `otherUsage` equal to that value, and the body contains no domain

#### Scenario: Computation fails
File: `apps/web/src/lib/device/heartbeat.test.ts`
- **GIVEN** a fake store whose `otherUsage` throws
- **WHEN** a valid body is sent
- **THEN** the response is `200 { rulesVersion: 3 }` and the entries were still stored

#### Scenario: Excludes the calling device and sums the others in the family timezone
File: `supabase/tests/cross-browser-usage.test.ts`
- **GIVEN** a child with devices A, B and C, `roblox.com` 120 s on A, 300 s on B and 60 s on C today, `roblox.com` 500 s yesterday on B, timezone `Asia/Ho_Chi_Minh`, and a second child's device with 900 s
- **WHEN** `device_other_usage(A, "Asia/Ho_Chi_Minh")` runs as the service role
- **THEN** it returns `roblox.com` 360 and nothing from yesterday or the other child

#### Scenario: Day rollover in the family timezone
File: `supabase/tests/cross-browser-usage.test.ts`
- **GIVEN** B has `roblox.com` 60 s at `2026-11-17T16:59:00Z` and 30 s at `2026-11-17T17:00:00Z`, timezone `Asia/Ho_Chi_Minh`, and now is `2026-11-17T17:00:30Z`
- **WHEN** `device_other_usage(A, "Asia/Ho_Chi_Minh")` runs
- **THEN** it returns 30 s only

#### Scenario: Invalid timezone and permissions
File: `supabase/tests/cross-browser-usage.test.ts`
- **WHEN** the function is called with timezone `Not/AZone`, and as `anon` and as an authenticated parent
- **THEN** the first raises `invalid_timezone` and the other two are denied
