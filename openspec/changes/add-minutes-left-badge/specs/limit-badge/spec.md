## ADDED Requirements

### Requirement: Minutes left are computed from limit and usage
`minutesLeft(limits, seconds, category)` SHALL return the whole minutes left, rounded up, when the category has a limit and more than 0 and at most 300 seconds are left, and `null` otherwise (no limit, no category, more than 300 seconds left, or at or over the limit).

#### Scenario: Rounded up within five minutes
File: `apps/extension/lib/limits.test.ts`
- **GIVEN** limit `games 10` and used seconds of `games` 300, 360, 540 and 599
- **WHEN** `minutesLeft` runs for `games`
- **THEN** the results are `5`, `4`, `1` and `1`

#### Scenario: Nothing outside the window
File: `apps/extension/lib/limits.test.ts`
- **GIVEN** limit `games 10`
- **WHEN** `minutesLeft` runs with used `games` 299 (301 left), 600 and 700, with category `news` (no limit), and with category `null`
- **THEN** every result is `null`

### Requirement: The badge shows the active tab's minutes left
After every tracker event and every normal alarm the controller SHALL set the action badge text to the minutes left for the category of the tracker's current domain (categorized with the stored overrides, using the usage of the current family-timezone day and the stored limits), with amber background `#F59E0B`. It SHALL set the text to the empty string when `minutesLeft` is `null`, there is no current domain, or the stored usage is of another day.

#### Scenario: Tab with a limit near its end shows minutes
File: `apps/extension/lib/badge.test.ts`
- **GIVEN** a token, limit `games 10`, usage `games 480` of today, and a fake badge
- **WHEN** a `tab` event for `https://www.roblox.com/home` is handled
- **THEN** the badge text is `2` and the background color is `#F59E0B`

#### Scenario: Switching to a tab without a limit clears it
File: `apps/extension/lib/badge.test.ts`
- **GIVEN** the badge shows `2` for `roblox.com`
- **WHEN** a `tab` event for `https://www.wikipedia.org/` and then one with `url: null` are handled
- **THEN** the badge text is the empty string after each

#### Scenario: More than five minutes left shows nothing
File: `apps/extension/lib/badge.test.ts`
- **GIVEN** limit `games 30` and usage `games 600`
- **WHEN** a `tab` event for `https://www.roblox.com/` is handled
- **THEN** the badge text is the empty string

#### Scenario: Overrides decide the category
File: `apps/extension/lib/badge.test.ts`
- **GIVEN** `rulesOverrides` `{ "youtube.com": "games" }`, limit `games 10` and usage `games 540`
- **WHEN** a `tab` event for `https://www.youtube.com/watch` is handled
- **THEN** the badge text is `1`

#### Scenario: Alarm counts down and ends empty
File: `apps/extension/lib/badge.test.ts`
- **GIVEN** fake timers, limit `games 5`, the tracker on `roblox.com`, and one more completed minute of `roblox.com` per alarm starting from 0 seconds
- **WHEN** `onAlarm` runs once per minute, five times
- **THEN** the badge texts after the alarms are `4`, `3`, `2`, `1` and the empty string (limit reached)

#### Scenario: Usage of yesterday is ignored
File: `apps/extension/lib/badge.test.ts`
- **GIVEN** timezone `Asia/Ho_Chi_Minh`, limit `games 10`, stored usage day `2026-11-17` with `games 540`, and the tracker on `roblox.com`
- **WHEN** `onAlarm` runs at `2026-11-17T17:00:30Z`
- **THEN** the badge text is the empty string

### Requirement: The badge is cleared when the device is rejected
The controller SHALL set the badge text to the empty string on an alarm while the device is rejected.

#### Scenario: Rejected device clears the badge
File: `apps/extension/lib/badge.test.ts`
- **GIVEN** the badge shows `2` and stored `authState` is `rejected`
- **WHEN** `onAlarm` runs
- **THEN** the badge text is the empty string

### Requirement: Badge failures never break tracking
A rejected badge call SHALL be caught and logged and SHALL NOT stop event or alarm handling.

#### Scenario: Badge API rejects
File: `apps/extension/lib/badge.test.ts`
- **GIVEN** a fake badge whose `setBadgeText` rejects
- **WHEN** a `tab` event is handled and then `onAlarm` runs
- **THEN** `trackerState` is stored after the event, the heartbeat is posted at the alarm, and `log` was called

### Requirement: The badge adds no permission and no data
The manifest SHALL NOT gain a permission for the badge, and the badge port SHALL only receive text and a color.

#### Scenario: Permissions unchanged
File: `apps/extension/lib/manifest.test.ts`
- **WHEN** `buildManifest` runs
- **THEN** `permissions` equals `["tabs", "idle", "storage", "alarms", "declarativeNetRequest"]`

#### Scenario: Badge receives only text and color
File: `apps/extension/lib/badge.test.ts`
- **GIVEN** a fake badge recording its arguments and a limit near its end
- **WHEN** a `tab` event for `https://www.roblox.com/path?q=secret` is handled
- **THEN** the recorded arguments are only `{ text }` and `{ color }`, and contain neither `path` nor `secret`
