## ADDED Requirements

### Requirement: The rules response carries the child's other devices' usage
`GET /api/device/rules` SHALL include `otherUsage` `{ day, seconds }` (category seconds only, computed for the token's device as for the heartbeat response) as an extra of the body that is not part of the `RulesResponse` schema. The handler SHALL add it only when it passes `OtherUsage.safeParse`, after `RulesResponse.parse` of the base body. If it cannot be computed or is invalid the endpoint SHALL still answer 200 without it, never 500.

#### Scenario: Rules include other usage
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store whose `otherUsage` returns `{ day: "2026-11-17", seconds: { games: 600 } }`
- **WHEN** a valid request is handled
- **THEN** the body parses with `RulesResponse` and its `otherUsage` equals that value

#### Scenario: Other usage fails
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store whose `otherUsage` throws
- **WHEN** a valid request is handled
- **THEN** the status is 200 and the body has no `otherUsage`

#### Scenario: Invalid value does not cause a 500
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store whose `otherUsage` returns `{ day: "x", seconds: { games: -1 } }`
- **WHEN** a valid request is handled
- **THEN** the status is 200, the rules are returned, and the body has no `otherUsage`

#### Scenario: Contract
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `OtherUsage.safeParse` runs on `{ day: "2026-11-17", seconds: { games: 60 } }`, and on `{ day: "x", seconds: {} }`, an unknown category, a negative or fractional seconds value, or a domain key
- **THEN** the first parses and the rest fail
- **AND** `HeartbeatResponse` and `RulesResponse` still parse their base bodies when `otherUsage` is absent or invalid

### Requirement: The store maps domains to categories
The store method `otherUsage(deviceId)` SHALL map the domains of `device_other_usage` to categories with `categorize` and only the family's override rows (paged with `.range()`; the seeds are in `categorize`, and the 5000 limit of `listCategoryOverrides` SHALL NOT be relied on), and SHALL throw on an RPC error.

#### Scenario: Store maps domains to categories
File: `apps/web/src/lib/device/supabase-store.test.ts`
- **GIVEN** a fake client whose RPC `device_other_usage` returns `roblox.com 300` and `youtube.com 60`, with a family override `roblox.com` as `education` and an override of another family, and `day` `2026-11-17`
- **WHEN** `otherUsage(deviceId)` runs
- **THEN** the result is `{ day: "2026-11-17", seconds: { education: 300, entertainment: 60 } }` (by `categorize`) with no domain keys, a null-domain row adds nothing, only the family's override rows were read, and an RPC error makes it throw
