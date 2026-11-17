# Spec Delta

## Purpose

`POST /api/device/heartbeat`: devices authenticate with their token, report per-domain seconds per minute, and learn the child's current rules version.

Test files:
- `apps/web/src/lib/device/heartbeat.test.ts`: `handleHeartbeat` with a fake `HeartbeatStore` that records calls. "Now" is `2026-11-17T10:05:30Z` unless stated. "Valid token" means the fake store returns `{ deviceId: "dev-1", rulesVersion: 3 }` for `hashDeviceToken("tok-1")`. A "valid body" is `{ entries: [], currentDomain: null, browser: "edge", extensionVersion: "0.2.0" }` plus the entries named.
- `apps/web/src/lib/device/token.test.ts`: `hashDeviceToken`.
- `apps/web/src/lib/device/supabase-store.test.ts`: `createHeartbeatStore` with a fake Supabase client.
- `supabase/tests/heartbeat.test.ts`: migration, run on the PGlite harness from `add-database-schema`.

## ADDED Requirements

### Requirement: Device authentication
The endpoint SHALL accept only `Authorization: Bearer <token>` where the SHA-256 lowercase hex hash of `<token>` equals `devices.token_hash` of an existing device. Otherwise it SHALL respond `401` with body `{ "error": "unauthorized" }`, write nothing, and SHALL check authentication before validating the body.

#### Scenario: Token hash format
- **WHEN** `hashDeviceToken("abc")` is called
- **THEN** it returns `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`

#### Scenario: Missing or malformed header
- **WHEN** the handler is called with authorization `null`, then `""`, then `"tok-1"`, then `"Basic tok-1"`, then `"Bearer "`, each with a valid body
- **THEN** each response is `401 { error: "unauthorized" }`
- **AND** the store's `findDevice`, `upsertUsage` and `updateDevice` are never called

#### Scenario: Unknown or revoked token
- **GIVEN** the fake store returns `null` for every hash (token never issued, or device deleted by the parent)
- **WHEN** the handler is called with `Bearer tok-x` and a valid body
- **THEN** the response is `401 { error: "unauthorized" }`
- **AND** `findDevice` was called with `hashDeviceToken("tok-x")`
- **AND** `upsertUsage` and `updateDevice` are never called

#### Scenario: Auth checked before body
- **WHEN** the handler is called with authorization `null` and raw body `not json`
- **THEN** the response is `401`, not `400`

### Requirement: Body validation
After authentication, the body SHALL be parsed as JSON and validated with `HeartbeatRequest` from `@fg/shared`. Invalid JSON or a schema failure SHALL respond `400` with body `{ "error": "invalid_request" }` and write nothing.

#### Scenario: Invalid JSON
- **WHEN** a valid token sends raw body `{"entries":`
- **THEN** the response is `400 { error: "invalid_request" }`
- **AND** `upsertUsage` and `updateDevice` are never called

#### Scenario: Schema failure
- **WHEN** a valid token sends a valid body but with browser `firefox`, then one with an entry with seconds `61`, then one without `extensionVersion`
- **THEN** each response is `400 { error: "invalid_request" }` and nothing is written

### Requirement: Idempotent usage storage
Each kept entry SHALL be stored as a `usage_minutes` row `{ device_id, minute_utc, domain, seconds }` of the authenticated device, upserted on `(device_id, minute_utc, domain)` so that sending the same minute again replaces `seconds` instead of adding. Within one request, the last entry for a `(minuteUtc, domain)` pair SHALL win. No other field SHALL be written to `usage_minutes`.

#### Scenario: Entries stored for the device
- **WHEN** a valid token sends entries `{2026-11-17T10:03:00Z, youtube.com, 40}` and `{2026-11-17T10:04:00Z, khanacademy.org, 60}`
- **THEN** the response is `200 { rulesVersion: 3 }`
- **AND** `upsertUsage` is called once with exactly the rows `{device_id: "dev-1", minute_utc: "2026-11-17T10:03:00.000Z", domain: "youtube.com", seconds: 40}` and `{device_id: "dev-1", minute_utc: "2026-11-17T10:04:00.000Z", domain: "khanacademy.org", seconds: 60}`
- **AND** every row has exactly the keys `device_id`, `minute_utc`, `domain`, `seconds`

#### Scenario: Duplicate entries in one request
- **WHEN** a valid token sends entries `{10:03:00Z, youtube.com, 20}` then `{10:03:00Z, youtube.com, 35}`
- **THEN** `upsertUsage` receives one row for that minute and domain with seconds `35`

#### Scenario: No entries
- **WHEN** a valid token sends a valid body with `entries: []`
- **THEN** the response is `200 { rulesVersion: 3 }`
- **AND** `upsertUsage` is not called

#### Scenario: Store upserts on the primary key
- **WHEN** `createHeartbeatStore(fakeClient).upsertUsage(rows)` is called
- **THEN** the fake client records `from("usage_minutes")` and `upsert(rows, { onConflict: "device_id,minute_utc,domain" })`

#### Scenario: Resend replaces seconds in the database
- **GIVEN** the migrations are applied and a device exists
- **WHEN** the service role runs the same upsert statement twice for `(device, 2026-11-17T10:03:00Z, youtube.com)`, first with seconds `30`, then `45`
- **THEN** exactly one row exists for that key with seconds `45`

### Requirement: Stale, future and malformed entries are skipped
An entry SHALL be skipped (not stored, no error) when its `minuteUtc` is earlier than the start of the current UTC minute minus 7 days, later than the start of the current UTC minute, or not a whole minute, or when its `domain` does not match `^[a-z0-9-]+(\.[a-z0-9-]+)+$`. The remaining entries SHALL still be stored and the response SHALL be `200`.

#### Scenario: Age limits
- **WHEN** a valid token sends entries for `2026-11-10T10:05:00Z` (exactly 7 days before the minute of now), `2026-11-10T10:04:00Z` (older than 7 days), `2026-11-17T10:05:00Z` (current minute), `2026-11-17T10:06:00Z` (future) and `2026-11-18T00:00:00Z` (future), all domain `youtube.com` seconds `10`
- **THEN** the response is `200 { rulesVersion: 3 }`
- **AND** `upsertUsage` receives only the rows for `2026-11-10T10:05:00.000Z` and `2026-11-17T10:05:00.000Z`

#### Scenario: Not a whole minute
- **WHEN** a valid token sends an entry with `minuteUtc` `2026-11-17T10:03:30Z` and one with `2026-11-17T10:04:00Z`
- **THEN** only the `10:04:00` row is upserted

#### Scenario: Domain the database would reject
- **WHEN** a valid token sends entries with domains `localhost`, `YouTube.com`, `youtube.com/watch` and `youtube.com`
- **THEN** only the `youtube.com` row is upserted
- **AND** the response is `200`

#### Scenario: All entries skipped
- **WHEN** a valid token sends only a future entry
- **THEN** the response is `200`, `upsertUsage` is not called and `updateDevice` is called

### Requirement: Device status update
Every authenticated request with a valid body SHALL update the device with `last_seen_at` set to the server's now, `browser` and `extension_version` from the body, and nothing else. `currentDomain` SHALL NOT be stored anywhere.

#### Scenario: Device updated
- **WHEN** a valid token sends a valid body with browser `edge`, extensionVersion `0.2.0` and currentDomain `youtube.com`
- **THEN** `updateDevice` is called once with `"dev-1"` and exactly `{ last_seen_at: "2026-11-17T10:05:30.000Z", browser: "edge", extension_version: "0.2.0" }`
- **AND** no store call argument contains the value `youtube.com`

#### Scenario: Store failure
- **GIVEN** the fake store's `upsertUsage` (then, in a second case, `updateDevice`) throws
- **WHEN** a valid token sends a valid body with one valid entry
- **THEN** the response is `500 { error: "server_error" }`

#### Scenario: Store finds device with rules version
- **GIVEN** a fake client whose `devices` query returns `{ id: "dev-1", children: { rules_version: 7 } }`
- **WHEN** `createHeartbeatStore(fakeClient).findDevice("h")` is called
- **THEN** it returns `{ deviceId: "dev-1", rulesVersion: 7 }`
- **AND** the client recorded a filter `token_hash = "h"` on `devices`
- **AND** with a fake returning no row it returns `null`

### Requirement: Rules version in the response
A `200` response SHALL be a valid `HeartbeatResponse` whose `rulesVersion` is the `children.rules_version` of the device's child. `rules_version` SHALL start at 0 and SHALL increase whenever a block rule of that child is inserted, updated or deleted, or a domain category override of the child's family is inserted, updated or deleted. Global `domain_categories` rows and other families' changes SHALL NOT change it.

#### Scenario: Response shape
- **WHEN** a valid token sends a valid body
- **THEN** `HeartbeatResponse.parse(response.body)` succeeds and equals `{ rulesVersion: 3 }`

#### Scenario: New child starts at 0
- **WHEN** the service role inserts a child
- **THEN** its `rules_version` is `0`

#### Scenario: Block rule changes bump the version
- **GIVEN** child C of family A with `rules_version` `v`
- **WHEN** parent A inserts a block rule for C, then updates it, then deletes it
- **THEN** after each statement C's `rules_version` is greater than before

#### Scenario: Family override bumps all children of the family only
- **GIVEN** family A with children C1 and C2, and family B with child D
- **WHEN** parent A inserts a domain category override for family A
- **THEN** the `rules_version` of C1 and C2 increased
- **AND** D's `rules_version` is unchanged
- **AND** when the service role inserts a global domain category (`family_id` null), no child's `rules_version` changes

#### Scenario: Other family's rule does not bump
- **WHEN** parent B inserts a block rule for child D
- **THEN** the `rules_version` of C1 and C2 is unchanged

### Requirement: Extension version column
`devices` SHALL have a nullable `extension_version` column of at most 32 characters that parents can read.

#### Scenario: Column constraint and privilege
- **WHEN** the service role sets `extension_version` to a 33-character string
- **THEN** the update fails with a check violation
- **AND** setting `0.2.0` succeeds
- **AND** parent A can run `select extension_version from devices` and sees `0.2.0` for their device
