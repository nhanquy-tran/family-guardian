## ADDED Requirements

### Requirement: The heartbeat response carries the child's other devices' usage
A `200` response SHALL include `otherUsage` `{ day, seconds }`: today's date in the family timezone and today's seconds per category (domains mapped with the seed and family overrides) of the child's other devices, excluding the caller, with no domains. The handler SHALL add it only when it passes `OtherUsage.safeParse`; if it cannot be computed or is invalid the response SHALL still be `200` without it.

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

#### Scenario: Invalid value is omitted
File: `apps/web/src/lib/device/heartbeat.test.ts`
- **GIVEN** a fake store whose `otherUsage` returns `{ day: "x", seconds: { games: -1 } }`
- **WHEN** a valid body is sent
- **THEN** the response is `200 { rulesVersion: 3 }` without `otherUsage`

### Requirement: One SQL function computes the other devices' usage
`public.device_other_usage(p_device_id)` SHALL take only the device id, read the family timezone itself (`UTC` when unset, as `findChild`), and return the `day` with the per-domain sums so both share one clock. It SHALL return at most 1000 rows ordered by seconds descending, and be executable by `service_role` only (revoked from `public`, `anon` and `authenticated`).

#### Scenario: Excludes the calling device and sums the others in the family timezone
File: `supabase/tests/cross-browser-usage.test.ts`
- **GIVEN** a child with devices A, B and C, `roblox.com` 120 s on A, 300 s on B and 60 s on C today, `roblox.com` 500 s yesterday on B, timezone `Asia/Ho_Chi_Minh`, and a second child's device with 900 s
- **WHEN** `device_other_usage(A)` runs as the service role
- **THEN** every row has `day` equal to today in that timezone, and `roblox.com` has 360 s, with nothing from yesterday or the other child

#### Scenario: Day rollover in the family timezone
File: `supabase/tests/cross-browser-usage.test.ts`
- **GIVEN** B has `roblox.com` 60 s at `2026-11-17T16:59:00Z` and 30 s at `2026-11-17T17:00:00Z`, timezone `Asia/Ho_Chi_Minh`, and now is `2026-11-17T17:00:30Z`
- **WHEN** `device_other_usage(A)` runs
- **THEN** it returns `day` `2026-11-18` and 30 s only

#### Scenario: Defaults and caps
File: `supabase/tests/cross-browser-usage.test.ts`
- **GIVEN** a family without a timezone and B with 1200 distinct domains today, then a child whose other devices have no usage
- **WHEN** `device_other_usage(A)` runs
- **THEN** `day` is the UTC date, at most 1000 rows come back with the highest seconds first, and with no usage one row has a null `domain`, 0 seconds and today's `day`

#### Scenario: Permissions
File: `supabase/tests/cross-browser-usage.test.ts`
- **WHEN** the function is called as `anon` and as an authenticated parent
- **THEN** both are denied, and the service role is allowed
