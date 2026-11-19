## ADDED Requirements

### Requirement: The badge counts the other devices' usage
The badge SHALL compute minutes left from local usage plus the stored `otherUsage` of the same day, as for limit enforcement.

#### Scenario: Minutes left include the other browser
File: `apps/extension/lib/badge.test.ts`
- **GIVEN** limit `games 10`, local usage `games 240` and stored `otherUsage` `games 240` for today
- **WHEN** a `tab` event for `https://www.roblox.com/home` is handled
- **THEN** the badge text is `2`

#### Scenario: Stale other usage is ignored
File: `apps/extension/lib/badge.test.ts`
- **GIVEN** the same state but `otherUsage.day` is yesterday
- **WHEN** a `tab` event for `https://www.roblox.com/home` is handled
- **THEN** the badge text is the empty string
