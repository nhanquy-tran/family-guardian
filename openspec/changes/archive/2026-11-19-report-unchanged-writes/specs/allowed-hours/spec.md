## MODIFIED Requirements

### Requirement: Allowed hours are validated and saved fail-closed
`saveAllowedHours(client, childId, { start, end })` SHALL trim both values; both empty clears the window (both columns null); otherwise it SHALL return `{ ok: false, error: "invalid_hours" }` before any write when one is empty, either does not match `HH:MM` 00:00 to 23:59, or they are equal. Any store error or throw SHALL return `{ ok: false, error: "failed" }`. It SHALL ask for the updated row ids and return `{ ok: false, error: "not_found" }` when no row was updated.

#### Scenario: Valid window saved and empty clears
File: `apps/web/src/lib/allowed-hours.test.ts`
- **WHEN** `saveAllowedHours(client, childId, { start: " 07:00 ", end: "01:00" })` is called, and in another run with `{ start: "", end: " " }`
- **THEN** the fake client receives one update of `children` with `{ allowed_start: "07:00", allowed_end: "01:00" }` filtered by `id = childId`, and in the other run with both columns `null`
- **AND** both results are `{ ok: true }`

#### Scenario: Invalid input writes nothing
File: `apps/web/src/lib/allowed-hours.test.ts`
- **WHEN** it is called with (`07:00`, ``), (``, `21:00`), (`7:00`, `21:00`), (`24:00`, `01:00`), (`07:60`, `21:00`) and (`08:00`, `08:00`)
- **THEN** each result is `{ ok: false, error: "invalid_hours" }` and the fake client receives no update

#### Scenario: Store failure
File: `apps/web/src/lib/allowed-hours.test.ts`
- **GIVEN** the fake client returns an error on update, and in another run throws
- **WHEN** `saveAllowedHours` is called with valid values
- **THEN** each result is `{ ok: false, error: "failed" }` and none throws

#### Scenario: Hours for a child the parent cannot see
File: `apps/web/src/lib/allowed-hours.test.ts`
- **GIVEN** the fake client's update returns no rows and no error (RLS matched nothing)
- **WHEN** `saveAllowedHours` is called with valid values
- **THEN** the result is `{ ok: false, error: "not_found" }`
- **AND** `AllowedHoursCard` with `error="not_found"` shows "This child was not found. Reload the page and try again."
