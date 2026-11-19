## ADDED Requirements

### Requirement: The rules response carries the child's other devices' usage
`GET /api/device/rules` SHALL include `otherUsage` `{ day, seconds }` (category seconds only, computed for the token's device as for the heartbeat response) in `RulesResponse`, optional in the contract. If it cannot be computed the endpoint SHALL still answer 200 without it. The store SHALL map the domains of `device_other_usage` to categories with `categorize` and the merged overrides, and SHALL throw on an RPC error.

#### Scenario: Rules include other usage
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store whose `otherUsage` returns `{ day: "2026-11-17", seconds: { games: 600 } }`
- **WHEN** a valid request is handled
- **THEN** the body parses with `RulesResponse` and `otherUsage` equals that value

#### Scenario: Other usage fails
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store whose `otherUsage` throws
- **WHEN** a valid request is handled
- **THEN** the status is 200 and the body has no `otherUsage`

#### Scenario: Contract
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `RulesResponse` and `HeartbeatResponse` parse bodies without `otherUsage`, with `{ day: "2026-11-17", seconds: { games: 60 } }`, and with `{ day: "x", seconds: {} }`, an unknown category, a negative or fractional seconds value, or a domain key
- **THEN** the first two parse and the rest fail

#### Scenario: Store maps domains to categories
File: `apps/web/src/lib/device/supabase-store.test.ts`
- **GIVEN** a fake client whose RPC `device_other_usage` returns `roblox.com 300` and `youtube.com 60`, with a family override `roblox.com` as `education`, and timezone `Asia/Ho_Chi_Minh`
- **WHEN** `otherUsage(deviceId)` runs
- **THEN** `seconds` is `education 300` and `entertainment 60` (by `categorize`) with no domain keys, and an RPC error makes it throw
