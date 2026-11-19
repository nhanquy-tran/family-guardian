## ADDED Requirements

### Requirement: The extension stores the other devices' usage from responses
When a heartbeat or rules response contains a valid `otherUsage`, the extension SHALL store it as `otherUsage`, replacing the previous value. A response without it SHALL leave the stored value unchanged. Unpairing SHALL remove it.

#### Scenario: Stored from heartbeat and rules, kept when absent
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** a token and a heartbeat answering `otherUsage` `{ day, seconds: { games: 120 } }`, then one answering only `rulesVersion`
- **WHEN** `onAlarm` runs twice, and `syncRules` then runs with a rules answer carrying `games: 240`
- **THEN** `otherUsage` is `games 120` after both alarms and `games 240` after the sync

#### Scenario: Unpair clears it
File: `apps/extension/lib/pairing.test.ts`
- **GIVEN** a stored `otherUsage`
- **WHEN** the extension unpairs
- **THEN** `otherUsage` is removed
