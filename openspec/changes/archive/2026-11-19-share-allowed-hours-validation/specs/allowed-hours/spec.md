## ADDED Requirements

### Requirement: Allowed-hours validation is shared
`@fg/shared` SHALL export `HHMM_PATTERN`, the `AllowedHours` type and `parseAllowedHours(start, end)`, which SHALL return `{ start, end }` for two different `HH:MM` strings (midnight crossing is valid) and `null` otherwise. The contract, the extension and the web app SHALL use them and SHALL NOT define their own.

#### Scenario: Valid windows parse
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `parseAllowedHours` is called with (`07:00`, `21:00`), (`22:00`, `06:00`) and (`00:00`, `23:59`)
- **THEN** each returns `{ start, end }` with the given values

#### Scenario: Invalid windows return null
File: `packages/shared/src/contracts.test.ts`
- **WHEN** it is called with (`24:00`, `01:00`), (`7:00`, `21:00`), (`07:60`, `21:00`), (`07:00`, ``), (`08:00`, `08:00`), (`07:00`, `undefined`) and (`07:00`, `7`)
- **THEN** each returns `null`
