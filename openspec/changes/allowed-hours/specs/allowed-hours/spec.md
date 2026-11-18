## ADDED Requirements

### Requirement: Allowed hours are stored per child
`children` SHALL have `allowed_start` and `allowed_end` (`HH:MM`, 24 h), both null or both set, with `allowed_start <> allowed_end`. Parents SHALL be able to update them only for children of their own family (existing RLS). An update that changes either value SHALL bump the child's `rules_version` once.

#### Scenario: Value constraints
File: `supabase/tests/allowed-hours.test.ts`
- **WHEN** the service role sets (`07:00`, `21:00`), (`07:00`, `07:00`), (`24:00`, `01:00`), (`7:00`, `21:00`), (`07:00`, null) and (`22:00`, `06:00`)
- **THEN** the first and last succeed and the other four fail (check violation)

#### Scenario: Parent edits only own family
File: `supabase/tests/allowed-hours.test.ts`
- **GIVEN** a child of family B
- **WHEN** parent A updates that child's allowed hours
- **THEN** zero rows are affected
- **AND** parent A can update their own child's allowed hours, and cannot update `rules_version` directly

#### Scenario: Changes bump rules_version once
File: `supabase/tests/allowed-hours.test.ts`
- **GIVEN** a child with `rules_version` `0` and a second child
- **WHEN** allowed hours are set, then set to the same values, then cleared
- **THEN** `rules_version` is `1` after the first step, `1` after the unchanged save and `2` after clearing
- **AND** the second child's `rules_version` is unchanged

### Requirement: Rules contract carries allowed hours
`RulesResponse` SHALL accept `allowedHours`, either `null` or `{ start, end }` with both matching `^([01][0-9]|2[0-3]):[0-5][0-9]$` and different from each other, default `null`. A body without the field SHALL still parse.

#### Scenario: Contract bounds
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `RulesResponse` parses `allowedHours` `{ start: "07:00", end: "01:00" }` and `null`
- **THEN** both parse unchanged
- **AND** `{ start: "7:00", end: "21:00" }`, `{ start: "24:00", end: "01:00" }`, `{ start: "07:00", end: "07:00" }` and `{ start: "07:00" }` each fail, and a body without the field parses with `allowedHours` `null`

### Requirement: Rules API returns the allowed hours
`GET /api/device/rules` SHALL return the token's child's `allowedHours` (`null` when unset). A database error SHALL fail the request closed with `500 { error: "server_error" }` as for the other fields.

#### Scenario: Hours returned and null when unset
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store whose child has hours `07:00`/`21:00`, and in another run none
- **WHEN** a valid request is handled
- **THEN** the body `allowedHours` is `{ start: "07:00", end: "21:00" }`, and `null` in the other run, and both bodies parse with `RulesResponse`

#### Scenario: Store maps the columns
File: `apps/web/src/lib/device/supabase-store.test.ts`
- **GIVEN** a fake client returning a child row with `allowed_start` `07:00` and `allowed_end` `21:00`, and in another run both null, and in a third run a database error
- **WHEN** `findChild` is called
- **THEN** it returns `allowedHours` `{ start: "07:00", end: "21:00" }`, then `null`, and in the third run it throws

### Requirement: Allowed hours are validated and saved fail-closed
`saveAllowedHours(client, childId, { start, end })` SHALL trim both values; both empty clears the window (both columns null); otherwise it SHALL return `{ ok: false, error: "invalid_hours" }` before any write when one is empty, either does not match `HH:MM` 00:00 to 23:59, or they are equal. Any store error or throw SHALL return `{ ok: false, error: "failed" }`.

#### Scenario: Valid window saved
File: `apps/web/src/lib/allowed-hours.test.ts`
- **WHEN** `saveAllowedHours(client, childId, { start: " 07:00 ", end: "01:00" })` is called
- **THEN** the fake client receives one update of `children` with `{ allowed_start: "07:00", allowed_end: "01:00" }` filtered by `id = childId`, and the result is `{ ok: true }`

#### Scenario: Both empty clears
File: `apps/web/src/lib/allowed-hours.test.ts`
- **WHEN** `saveAllowedHours` is called with `{ start: "", end: " " }`
- **THEN** the update sets both columns to `null` and the result is `{ ok: true }`

#### Scenario: Invalid input writes nothing
File: `apps/web/src/lib/allowed-hours.test.ts`
- **WHEN** it is called with (`07:00`, ``), (``, `21:00`), (`7:00`, `21:00`), (`24:00`, `01:00`), (`07:60`, `21:00`) and (`08:00`, `08:00`)
- **THEN** each result is `{ ok: false, error: "invalid_hours" }` and the fake client receives no update

#### Scenario: Store failure
File: `apps/web/src/lib/allowed-hours.test.ts`
- **GIVEN** the fake client returns an error on update, and in another run throws
- **WHEN** `saveAllowedHours` is called with valid values
- **THEN** each result is `{ ok: false, error: "failed" }` and none throws

### Requirement: Allowed hours card on the rules page
The rules page SHALL render an "Allowed hours" card (`AllowedHoursCard`) with `time` inputs `allowed_start` and `allowed_end` prefilled with the saved values, a hidden `childId`, a save button posting to a server action, a note that empty fields remove the limit, and a readable message for `invalid_hours` and `failed`. It SHALL use only classes exported by `ui.ts`.

#### Scenario: Card markup
File: `apps/web/src/components/allowed-hours-card.test.ts`
- **WHEN** `AllowedHoursCard` renders with hours `07:00`/`21:00`, and in another run with `null` and error `invalid_hours`
- **THEN** the markup contains `Allowed hours`, two `type="time"` inputs named `allowed_start` and `allowed_end` with values `07:00` and `21:00` (no values in the other run), a hidden `childId` input, an alert mentioning start and end times in the other run, and the `card` and `buttonPrimary` class strings from `ui.ts` and no raw palette class

### Requirement: The window is evaluated in the family timezone
`inAllowedHours(hours, nowMs, timezone)` SHALL return true when the local time of day is inside the window: for `start < end` from `start` inclusive to `end` exclusive; for `start > end` from `start` inclusive across midnight to `end` exclusive. It SHALL use `UTC` for a missing or invalid timezone and return true (no restriction) for `null` or malformed hours. `nextEdge` SHALL return the first instant, at minute resolution within the next 48 hours, at which the answer changes, or `null`.

#### Scenario: Inside and outside, both window shapes
File: `apps/extension/lib/hours.test.ts`
- **GIVEN** timezone `Asia/Ho_Chi_Minh` (UTC+7) and window `07:00`-`21:00`
- **WHEN** `inAllowedHours` runs at `2026-11-17T23:59:00Z` (06:59), `2026-11-18T00:00:00Z` (07:00), `2026-11-18T13:59:00Z` (20:59) and `2026-11-18T14:00:00Z` (21:00)
- **THEN** the results are false, true, true, false
- **AND** with window `22:00`-`06:00` the results at 21:59 are false, at 22:00, 23:59, 00:00 and 05:59 local true, and at 06:00 false
- **AND** `null` hours and malformed hours return true, and timezone `Not/AZone` is read as `UTC`

#### Scenario: Next edge
File: `apps/extension/lib/hours.test.ts`
- **GIVEN** timezone `UTC`, window `07:00`-`21:00`
- **WHEN** `nextEdge` runs at `06:30:20Z`, at `10:00Z`, at `21:30Z` and with `null` hours
- **THEN** it returns `07:00:00Z` the same day, `21:00:00Z`, `07:00:00Z` the next day, and `null`
- **AND** for timezone `America/New_York` and window `07:00`-`21:00` at `2026-11-01T11:30:00Z` (06:30 EST, after the DST change) it returns `2026-11-01T12:00:00Z`

### Requirement: One DNR rule pauses all browsing outside the window
`buildHoursRule(start)` SHALL return one rule with id `2000000`, priority 2, `main_frame` only, `regexFilter` `^https?://`, redirecting to `/blocked.html?h=<start>`. `reconcileHours` SHALL add the rule (and remove only that id when entering the window) through `updateDynamicRules` only when the paused state differs from the stored `hoursPaused`, store `hoursPaused` after success, store nothing and retry at the next alarm when the update fails, and set the `hours-edge` alarm at `nextEdge`.

#### Scenario: Rule shape
File: `apps/extension/lib/hours.test.ts`
- **WHEN** `buildHoursRule("07:00")` runs
- **THEN** the result is `{ id: 2000000, priority: 2, action: { type: "redirect", redirect: { extensionPath: "/blocked.html?h=07:00" } }, condition: { regexFilter: "^https?://", resourceTypes: ["main_frame"] } }`

#### Scenario: Edges switch the rule on and off
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** fake timers, stored hours `07:00`-`21:00`, timezone `UTC`, no `hoursPaused`, time `2026-11-18T20:59:30Z`
- **WHEN** the clock reaches `21:00:00Z` and the `hours-edge` alarm fires, then reaches `07:00:00Z` the next day and it fires again
- **THEN** after the first the DNR rules contain the hours rule with `h=07:00` and `hoursPaused` is true, after the second the rule is gone and `hoursPaused` is false
- **AND** a second alarm inside the same state makes no `updateDynamicRules` call
- **AND** the `hours-edge` alarm was set to `21:00:00Z`, then `07:00:00Z`

#### Scenario: Window crossing midnight
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** stored hours `07:00`-`01:00`, timezone `UTC`, time `2026-11-18T23:30:00Z`
- **WHEN** the alarm fires at `23:30Z`, at `01:00:00Z` the next day, and at `07:00:00Z`
- **THEN** the hours rule is absent, present, then absent

#### Scenario: Offline, rejected and restart
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** stored hours `07:00`-`21:00` and timezone `UTC`, the heartbeat failing with a network error in one run and answering 401 in another, time `22:00Z`, and a new controller on the persisted storage (`hoursPaused` absent) as after a browser restart
- **WHEN** `onAlarm` runs
- **THEN** the hours rule is applied in both runs, and the `hours-edge` alarm is set to `07:00Z` the next day

#### Scenario: Update failure retries
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** a time outside the window and `updateDynamicRules` rejecting once
- **WHEN** `onAlarm` runs twice
- **THEN** after the first `hoursPaused` is not stored and after the second the rule is applied and `hoursPaused` is true

### Requirement: Rule syncs keep and store the hours
`syncRules` SHALL store `rulesAllowedHours` with the other rule inputs only after a successful DNR update, and every call that replaces the dynamic rules SHALL include the hours rule when the new hours say paused at that time. A failed sync SHALL keep the stored hours and rule.

#### Scenario: Sync outside the window keeps the hours rule
File: `apps/extension/lib/rules.test.ts`
- **GIVEN** time `22:00Z`, an answer with `allowedHours` `07:00`-`21:00`, `domains: ["a.com"]`, timezone `UTC`, and existing dynamic rule ids `[1, 2000000]`
- **WHEN** `syncRules` runs
- **THEN** one `updateDynamicRules` call removes `[1, 2000000]` and adds the `a.com` rule and the hours rule, and storage holds `rulesAllowedHours` `{ start: "07:00", end: "21:00" }`

#### Scenario: Removing the window lifts the pause
File: `apps/extension/lib/rules.test.ts`
- **GIVEN** stored hours, `hoursPaused` true, and an answer with `allowedHours: null`
- **WHEN** `syncRules` runs, and in another run `updateDynamicRules` rejects
- **THEN** in the first the hours rule is not added, `rulesAllowedHours` is removed and `hoursPaused` is false; in the failing run storage and rules are unchanged and the result is `failed`

### Requirement: Re-pairing resets the hours state
A successful `pairWithCode` SHALL remove `rulesAllowedHours` and `hoursPaused` and clear the `hours-edge` alarm; a failed one SHALL change nothing.

#### Scenario: Re-pair and failed pair
File: `apps/extension/lib/pairing.test.ts`
- **GIVEN** stored `rulesAllowedHours`, `hoursPaused` true and a scheduled `hours-edge` alarm
- **WHEN** pairing succeeds, and in another run fails with `invalid_code`
- **THEN** the first removes both keys and the alarm, the second changes nothing

### Requirement: The block page says when browsing resumes
`describeBlock(search)` SHALL return the text `Browsing is paused until HH:MM` when the query has `h` matching `^[0-9]{2}:[0-9]{2}$`, and the generic text otherwise. The page SHALL read no URL and send no message for this block.

#### Scenario: Paused text
File: `apps/extension/lib/blocked.test.ts`
- **WHEN** `describeBlock` runs with `?h=07:00`, `?h=<script>`, `?h=7:0` and an empty query
- **THEN** the first returns `Browsing is paused until 07:00` and the others the generic block text
