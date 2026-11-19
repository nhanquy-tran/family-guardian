## ADDED Requirements

### Requirement: The extension stores the other devices' usage from responses
`FlushResult` `ok` SHALL carry `otherUsage?` taken from the last `200` chunk response of the flush (a flush can send several chunks). The controller SHALL store it as `otherUsage` before limit evaluation, and `syncRules` SHALL store the one from the rules response, each replacing the previous value. A response without it SHALL leave the stored value unchanged.

#### Scenario: Stored from heartbeat and rules, kept when absent
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** a token and a heartbeat answering `otherUsage` `{ day, seconds: { games: 120 } }`, then one answering only `rulesVersion`
- **WHEN** `onAlarm` runs twice, and `syncRules` then runs with a rules answer carrying `games: 240`
- **THEN** `otherUsage` is `games 120` after both alarms and `games 240` after the sync

#### Scenario: Several chunks use the last 200 response
File: `apps/extension/lib/sender.test.ts`
- **GIVEN** a queue that needs three chunk requests, answered `200` with `otherUsage` `games 60`, `200` with `games 120`, `200` with `games 180`
- **WHEN** `flushQueue` runs
- **THEN** the result is `ok` with `otherUsage` `games 180`

### Requirement: An invalid other-usage field never fails a response
The extension SHALL parse `otherUsage` separately with `OtherUsage.safeParse`, only after the base `HeartbeatResponse` or `RulesResponse` has parsed. An invalid value SHALL be ignored, the stored value kept, and the heartbeat or sync SHALL still succeed.

#### Scenario: Invalid field in a heartbeat is ignored
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** stored `otherUsage` `games 120` and a heartbeat answering `rulesVersion` and `otherUsage` `{ day: "x", seconds: { games: -5 } }`
- **WHEN** `onAlarm` runs
- **THEN** the flush is `ok`, the queue is acknowledged, the rules sync still runs on a new `rulesVersion`, and `otherUsage` is still `games 120`

#### Scenario: Invalid field in a rules sync is ignored
File: `apps/extension/lib/rules.test.ts`
- **GIVEN** stored `otherUsage` `games 120` and a valid rules answer carrying `otherUsage` `{ day: "2026-11-17", seconds: { games: 1.5 } }`
- **WHEN** `syncRules` runs
- **THEN** the rules, limits and `rulesVersion` are applied and stored, and `otherUsage` is still `games 120`
