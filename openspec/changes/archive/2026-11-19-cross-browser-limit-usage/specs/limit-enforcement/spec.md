## ADDED Requirements

### Requirement: Limits count the other devices' usage
Limit evaluation (controller alarm and `syncRules`) SHALL compare each category's limit with the local `limitUsage` seconds plus the stored `otherUsage.seconds` of that category, only when `otherUsage.day` equals today's `dayKey` in the family timezone; otherwise `otherUsage` SHALL count as empty. It SHALL work offline with the last stored `otherUsage`.

#### Scenario: Two browsers reach the limit together
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** limit `games 5`, local `roblox.com` 120 s and stored `otherUsage` `games 180` for today
- **WHEN** `onAlarm` runs
- **THEN** `games` is blocked, and with `otherUsage` `games 179` it is not

#### Scenario: Other browser's usage arrives with the heartbeat
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** limit `games 5`, local usage 120 s, and a heartbeat answering `otherUsage` `games 180`
- **WHEN** `onAlarm` runs
- **THEN** `games` is blocked in the same alarm

#### Scenario: Offline uses the last value
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** stored `otherUsage` `games 250`, limit `games 5` and a heartbeat that fails with a network error
- **WHEN** 60 more local seconds complete and `onAlarm` runs
- **THEN** `games` is blocked

#### Scenario: Day rollover ignores yesterday's value
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** timezone `Asia/Ho_Chi_Minh` and `games` blocked by `otherUsage` `{ day: "2026-11-17", seconds: { games: 300 } }`
- **WHEN** `onAlarm` runs at `2026-11-17T17:00:30Z` with no new response
- **THEN** the games rules are removed

#### Scenario: A sync applies it
File: `apps/extension/lib/rules.test.ts`
- **GIVEN** local usage `games 120` and a rules answer with `limits games 5` and `otherUsage` `games 180`
- **WHEN** `syncRules` runs
- **THEN** the games rules are applied and `limitBlocked` is stored from that update
