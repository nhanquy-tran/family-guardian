# Spec Delta

## Purpose

A signed-in parent sees each child's devices with online status, last seen time, browser, OS and extension version, and can rename or remove a device. Removing a device asks for confirmation first and then revokes its token.

Test files:
- `apps/web/src/lib/devices/status.test.ts`
- `apps/web/src/lib/devices/devices.test.ts`
- `apps/web/src/components/device-list.test.ts`
- `supabase/tests/devices.test.ts` (PGlite with the harness from `add-database-schema`; "parent A" and "parent B" belong to different families, each with one child and one device created by the service role)

A fixed `now` of `2026-11-17T10:00:00Z` is used in web tests.

## ADDED Requirements

### Requirement: Online status
`deviceStatus(lastSeenAt, now)` SHALL return `"online"` when `lastSeenAt` is not null and less than 3 minutes before `now`, and `"offline"` otherwise. A `lastSeenAt` after `now` SHALL count as online.

#### Scenario: Seen recently is online
- **WHEN** `deviceStatus` is called with `2026-11-17T09:59:00Z` and with `2026-11-17T09:57:00.001Z` (`status.test.ts`)
- **THEN** each returns `"online"`

#### Scenario: Seen 3 minutes ago or more is offline
- **WHEN** `deviceStatus` is called with `2026-11-17T09:57:00Z` and with `2026-11-16T10:00:00Z` (`status.test.ts`)
- **THEN** each returns `"offline"`

#### Scenario: Never seen is offline
- **WHEN** `deviceStatus(null, now)` is called (`status.test.ts`)
- **THEN** it returns `"offline"`

#### Scenario: Clock skew counts as online
- **WHEN** `deviceStatus` is called with `2026-11-17T10:00:30Z` (`status.test.ts`)
- **THEN** it returns `"online"`

### Requirement: Relative last seen text
`formatLastSeen(lastSeenAt, now)` SHALL return `"Never"` for null, `"just now"` for less than 60 seconds (or a future time), `"<m> min ago"` below 60 minutes, `"<h> h ago"` below 24 hours and `"<d> d ago"` otherwise, with values floored.

#### Scenario: Formatting buckets
- **WHEN** `formatLastSeen` is called with null, `09:59:30Z`, `10:00:30Z`, `09:58:00Z`, `09:01:00Z`, `07:30:00Z` on 2026-11-17, and `2026-11-14T09:00:00Z` (`status.test.ts`)
- **THEN** the results are `"Never"`, `"just now"`, `"just now"`, `"2 min ago"`, `"59 min ago"`, `"2 h ago"`, `"3 d ago"`

### Requirement: Device label
`deviceLabel(device)` SHALL return the trimmed device name when it is not empty, else `"<Browser> on <os>"` where Browser is `Chrome`, `Edge`, `Brave` or `Other browser`.

#### Scenario: Blank name falls back to default
- **WHEN** `deviceLabel` is called with `{ name: "   ", browser: "brave", os: "Windows" }` (`status.test.ts`)
- **THEN** the result is `"Brave on Windows"`

#### Scenario: Name or default
- **WHEN** `deviceLabel` is called with `{ name: "Lan's laptop", browser: "chrome", os: "Windows" }`, `{ name: null, browser: "edge", os: "Windows" }` and `{ name: null, browser: "other", os: "Windows" }` (`status.test.ts`)
- **THEN** the results are `"Lan's laptop"`, `"Edge on Windows"` and `"Other browser on Windows"`

### Requirement: Devices listed per child
`listDevicesByChild(client)` SHALL query `children` with their `devices` (`id, name, browser, os, extension_version, last_seen_at, created_at`), ordered by child name, devices ordered by `created_at` ascending, and SHALL NOT select `token_hash`. On a query error it SHALL return `null`.

#### Scenario: Grouped and ordered
- **GIVEN** a fake client whose `children` query resolves two children, the first with two devices in reverse `created_at` order (`devices.test.ts`)
- **WHEN** `listDevicesByChild(client)` is called
- **THEN** `from` was called with `"children"`, the select string contains no `token_hash`, `order` was called with `"name"`
- **AND** the result keeps the children and lists the first child's devices oldest first

#### Scenario: Query error
- **GIVEN** a fake client whose query resolves a non-null `error` (`devices.test.ts`)
- **WHEN** `listDevicesByChild(client)` is called
- **THEN** it returns `null`

### Requirement: Rename a device
`renameDevice(client, id, rawName)` SHALL trim the name, reject names outside 1..40 characters with `{ ok: false, error: "invalid-name" }` without calling the client, otherwise update only `name` for that id and return `{ ok: true }`, or `{ ok: false, error: "failed" }` when the update errors or affects no row.

#### Scenario: Valid rename
- **GIVEN** a fake client whose update resolves `{ data: [{ id: "d1" }], error: null }` (`devices.test.ts`)
- **WHEN** `renameDevice(client, "d1", "  Lan's laptop  ")` is called
- **THEN** `from("devices").update` was called with exactly `{ name: "Lan's laptop" }` and `eq("id", "d1")`
- **AND** the result is `{ ok: true }`

#### Scenario: Invalid name
- **WHEN** `renameDevice` is called with `"   "` and with a 41-character name (`devices.test.ts`)
- **THEN** each returns `{ ok: false, error: "invalid-name" }` and `from` was not called

#### Scenario: Not found or not allowed
- **GIVEN** a fake client whose update resolves `{ data: [], error: null }`, and one resolving a non-null `error` (`devices.test.ts`)
- **WHEN** `renameDevice(client, "d9", "Laptop")` is called for each
- **THEN** each returns `{ ok: false, error: "failed" }`

### Requirement: Remove a device
`removeDevice(client, id)` SHALL delete the device row with that id and return `{ ok: true }`, or `{ ok: false, error: "failed" }` when the delete errors or affects no row.

#### Scenario: Remove succeeds
- **GIVEN** a fake client whose delete resolves `{ data: [{ id: "d1" }], error: null }` (`devices.test.ts`)
- **WHEN** `removeDevice(client, "d1")` is called
- **THEN** `from("devices").delete()` and `eq("id", "d1")` were called and the result is `{ ok: true }`

#### Scenario: Remove fails
- **GIVEN** a fake client whose delete resolves `{ data: [], error: null }`, and one resolving a non-null `error` (`devices.test.ts`)
- **WHEN** `removeDevice(client, "d9")` is called for each
- **THEN** each returns `{ ok: false, error: "failed" }`

### Requirement: Error codes map to messages
`deviceErrorMessage(code)` SHALL return the message for `invalid-name`, `failed` and `load`, and `null` for any other value, including `undefined`, an empty string and markup such as `<script>`. The page SHALL show only these messages and never the raw `error` value.

#### Scenario: Known and unknown codes
- **WHEN** `deviceErrorMessage` is called with `"invalid-name"`, `"failed"`, `"load"`, `"nope"`, `"<script>alert(1)</script>"`, `""` and `undefined` (`devices.test.ts`)
- **THEN** the first three return "Name must be 1 to 40 characters.", "Something went wrong. Please try again." and "Could not load devices. Please reload the page."
- **AND** the other four return `null`

### Requirement: Devices page markup
`DeviceList` SHALL show, per child, the child's name and for each device its label, browser, OS, extension version (`"unknown"` when null), last seen text and a status badge with `data-status` and text `Online` or `Offline`; a rename form and a Remove link; a remove confirmation panel only for the device chosen with `confirmRemoveId`; and for a child without devices the text "No devices yet" with a link to `/dashboard/children`. It SHALL show the message for a given error code.

#### Scenario: Online and offline devices rendered
- **GIVEN** child "Lan" with device A (`name` null, `chrome`, `Windows`, version `0.1.0`, last seen `09:58:00Z`) and device B (`name` "Old PC", `edge`, `Windows`, version null, last seen `09:50:00Z`) (`device-list.test.ts`)
- **WHEN** `DeviceList` is rendered with `now` 10:00:00Z
- **THEN** the markup contains "Lan", "Chrome on Windows", "0.1.0", "2 min ago", "Old PC", "unknown", "10 min ago"
- **AND** it contains one `data-status="online"` with text "Online" and one `data-status="offline"` with text "Offline"

#### Scenario: Rename and remove controls
- **WHEN** `DeviceList` is rendered with one device `d1` (`device-list.test.ts`)
- **THEN** the markup contains a hidden input `name="deviceId"` with `value="d1"`, an input `name="name"` with `maxLength` 40 and a "Rename" button
- **AND** a link "Remove" with `href="/dashboard/devices?remove=d1"`
- **AND** it does not contain "Yes, remove" or "usage history will be deleted"

#### Scenario: Remove confirmation names device and child
- **GIVEN** child "Lan" with device `d1` named "Old PC" and device `d2` named "New PC" (`device-list.test.ts`)
- **WHEN** `DeviceList` is rendered with `confirmRemoveId` `"d1"`
- **THEN** the markup contains one panel with "Old PC", "Lan", "delete the device and its usage history" and "cannot be undone"
- **AND** a "Yes, remove" button inside a form with a hidden input `name="deviceId"` and `value="d1"`
- **AND** a "Cancel" link with `href="/dashboard/devices"`
- **AND** "Yes, remove" appears exactly once, and `d2` has only its "Remove" link

#### Scenario: Confirmation for an unknown device
- **WHEN** `DeviceList` is rendered with `confirmRemoveId` `"zzz"` that matches no device, and with `confirmRemoveId` `null` (`device-list.test.ts`)
- **THEN** neither markup contains "Yes, remove"

#### Scenario: Child without devices
- **WHEN** `DeviceList` is rendered with child "Minh" having no devices (`device-list.test.ts`)
- **THEN** the markup contains "No devices yet" and an `<a` with `href="/dashboard/children"`

#### Scenario: Error messages
- **WHEN** `DeviceList` is rendered with `error` `"invalid-name"`, then `"failed"`, then `"load"` (`device-list.test.ts`)
- **THEN** the markup contains "Name must be 1 to 40 characters.", "Something went wrong. Please try again." and "Could not load devices. Please reload the page." respectively

### Requirement: Device name column
A new migration `20261118090000_devices_name.sql`, built on `20261117000000_initial_schema.sql` and `20261117100000_heartbeat.sql`, SHALL add only the nullable column `devices.name` (1..40 characters). It SHALL NOT create or alter `devices.extension_version`, which already exists with its own check and select grant. Parents SHALL be able to select `name` and `extension_version` for their own family's devices.

#### Scenario: Columns and limits
- **WHEN** the service role updates a device's `name` to `""` and to a 41-character string (`devices.test.ts`)
- **THEN** each update fails with a check violation
- **AND** setting `name` `"Laptop"` succeeds and a new device row without a name has `name` null
- **AND** applying all migrations in order succeeds (the new migration does not conflict with `20261117100000_heartbeat.sql`)

#### Scenario: Parent reads the new columns
- **WHEN** parent A runs `select id, name, extension_version, last_seen_at from devices` (`devices.test.ts`)
- **THEN** it succeeds and returns only family A's device

### Requirement: Parents rename only their own devices and only the name
A parent SHALL be able to update `name` of their own family's devices. Updating another family's device SHALL affect zero rows. Updating any other column (`token_hash`, `child_id`, `last_seen_at`, `browser`, `os`, `extension_version`) SHALL fail with a permission error.

#### Scenario: Rename own device
- **WHEN** parent A updates `name` of family A's device to `"Lan's laptop"` (`devices.test.ts`)
- **THEN** one row is affected and the service role sees the new name

#### Scenario: Cannot rename another family's device
- **WHEN** parent A updates `name` of family B's device (`devices.test.ts`)
- **THEN** zero rows are affected and the service role sees family B's device unchanged

#### Scenario: Cannot change other columns
- **WHEN** parent A updates, one statement each, `token_hash`, `child_id`, `last_seen_at`, `browser`, `os` and `extension_version` of family A's device (`devices.test.ts`)
- **THEN** each statement fails with a permission error (SQLSTATE `42501`)

### Requirement: Remove asks for confirmation
The page SHALL NOT delete a device when the Remove link is followed. Only submitting the confirmation form SHALL call `removeDevice`. The confirmation SHALL be server-rendered without client JavaScript.

#### Scenario: Cancel deletes nothing
- **GIVEN** the confirmation for `d1` is shown (`device-list.test.ts`)
- **WHEN** the markup is inspected
- **THEN** the only way to delete is the form with `action` bound to `removeAction`, and the Cancel control is a link (`<a`) rather than a form, so cancelling cannot call `removeAction`
- **AND** the markup contains no `<script` and no `onclick`

#### Scenario: Confirm removes
- **GIVEN** a fake client whose delete resolves `{ data: [{ id: "d1" }], error: null }` (`devices.test.ts`)
- **WHEN** the confirmation form is submitted, which calls `removeDevice(client, "d1")`
- **THEN** the delete is called once for `d1` and the result is `{ ok: true }`

### Requirement: Removing a device revokes its token
When a parent deletes their own device, no device row SHALL match its token hash afterwards, and its usage rows SHALL be gone.

#### Scenario: Token no longer matches
- **GIVEN** family A's device with `token_hash` `"h-a"` and one `usage_minutes` row (`devices.test.ts`)
- **WHEN** parent A deletes that device
- **THEN** the service role finds zero `devices` rows with `token_hash = 'h-a'` and zero `usage_minutes` rows for that device id
- **AND** family B's device still exists
