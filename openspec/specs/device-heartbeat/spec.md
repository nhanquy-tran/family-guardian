# device-heartbeat Specification

## Purpose
`POST /api/device/heartbeat`: devices authenticate with their token, report per-domain seconds per minute, and learn the child's current rules version.

Test files:
- `apps/web/src/lib/device/heartbeat.test.ts`: `handleHeartbeat` with a fake `HeartbeatStore` that records calls. "Now" is `2026-11-17T10:05:30Z` unless stated. "Valid token" means the fake store returns `{ deviceId: "dev-1", rulesVersion: 3 }` for `hashDeviceToken("tok-1")`, sent as `Authorization: Bearer tok-1`. A "valid body" is `{ entries: [], currentDomain: null, browser: "edge", extensionVersion: "0.2.0" }` plus the entries named.
- `apps/web/src/lib/device/token.test.ts`: `hashDeviceToken`.
- `apps/web/src/lib/device/supabase-store.test.ts`: `createHeartbeatStore` with a fake Supabase client.
- `apps/web/src/app/api/device/heartbeat/route.test.ts`: exports of the route module.
- `packages/shared/src/contracts.test.ts`: `HeartbeatEnvelope`.
- `supabase/tests/heartbeat.test.ts`: migration, run on the PGlite harness from `add-database-schema`.

## Requirements

### Requirement: Device authentication
The endpoint SHALL accept only `Authorization: <scheme> <token>` where the scheme is `Bearer` (case-insensitive), there is exactly one token, and the SHA-256 lowercase hex hash of `<token>` equals `devices.token_hash` of an existing device. Otherwise it SHALL respond `401` with body `{ "error": "unauthorized" }`, write nothing, and SHALL check authentication before validating the body. If looking up the device fails, it SHALL respond `500` and write nothing.

#### Scenario: Token hash format
- **GIVEN** the helper `hashDeviceToken` in `apps/web/src/lib/device/token.ts`
- **WHEN** `hashDeviceToken("abc")` is called
- **THEN** it returns `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`

#### Scenario: Missing or malformed header
- **GIVEN** a valid token and a valid body
- **WHEN** the handler is called with authorization `null`, then `""`, then `"tok-1"`, then `"Basic tok-1"`, then `"Bearer "`, then `"Bearer a b"`
- **THEN** each response is `401 { error: "unauthorized" }`
- **AND** the store's `findDevice`, `upsertUsage` and `updateDevice` are never called

#### Scenario: Scheme is case-insensitive
- **GIVEN** a valid token and a valid body
- **WHEN** the handler is called with authorization `bearer tok-1`, then `BEARER tok-1`
- **THEN** each response is `200 { rulesVersion: 3 }`
- **AND** `findDevice` was called with `hashDeviceToken("tok-1")`

#### Scenario: Unknown or revoked token
- **GIVEN** the fake store returns `null` for every hash (token never issued, or device deleted by the parent)
- **WHEN** the handler is called with `Bearer tok-x` and a valid body
- **THEN** the response is `401 { error: "unauthorized" }`
- **AND** `findDevice` was called with `hashDeviceToken("tok-x")`
- **AND** `upsertUsage` and `updateDevice` are never called

#### Scenario: Auth checked before body
- **GIVEN** no authorization header
- **WHEN** the handler is called with authorization `null` and raw body `not json`
- **THEN** the response is `401`, not `400`

#### Scenario: Device lookup fails
- **GIVEN** the fake store's `findDevice` throws
- **WHEN** the handler is called with `Bearer tok-1` and a valid body
- **THEN** the response is `500 { error: "server_error" }`
- **AND** `upsertUsage` and `updateDevice` are never called

#### Scenario: Only POST is exported
- **GIVEN** the route module `apps/web/src/app/api/device/heartbeat/route.ts`
- **WHEN** its exports are listed
- **THEN** it exports `POST` and none of `GET`, `PUT`, `PATCH`, `DELETE`
- **AND** Next.js therefore answers `GET` with `405`

### Requirement: Envelope validation
After authentication, the body SHALL be parsed as JSON and its envelope (`entries` array of items of any shape, `browser`, `extensionVersion`, `currentDomain`) validated with `HeartbeatEnvelope` from `@fg/shared`. Invalid JSON or envelope SHALL respond `400 { "error": "invalid_request" }` and write nothing. Invalid individual entries SHALL NOT cause a `400`. `browser` SHALL be one of `chrome`, `edge`, `brave`, `firefox`, `other`.

#### Scenario: Envelope check order
- **GIVEN** a valid token
- **WHEN** it sends 1441 entries together with browser `netscape`
- **THEN** the response is `400 { error: "invalid_request" }`, not `413`

#### Scenario: Invalid JSON
- **GIVEN** a valid token
- **WHEN** it sends raw body `{"entries":`
- **THEN** the response is `400 { error: "invalid_request" }`
- **AND** `upsertUsage` and `updateDevice` are never called

#### Scenario: Envelope failure
- **GIVEN** a valid token
- **WHEN** it sends a valid body but with browser `netscape`, then one without `extensionVersion`, then one with a 33-character `extensionVersion`, then one with `entries` not an array, then one without `currentDomain`
- **THEN** each response is `400 { error: "invalid_request" }` and nothing is written

#### Scenario: Envelope schema in shared package
- **GIVEN** `HeartbeatEnvelope` and `HeartbeatRequest` from `@fg/shared`
- **WHEN** a body with one entry of `seconds: 61` is parsed with each
- **THEN** `HeartbeatEnvelope` accepts it and `HeartbeatRequest` rejects it
- **AND** `UsageEntry` is still the per-entry schema used by `HeartbeatRequest`
- **AND** both parse `{ entries: [], currentDomain: null, browser: "firefox", extensionVersion: "0.3.0" }` successfully and both reject the same body with `browser: "netscape"` (`contracts.test.ts`)

### Requirement: Batch size cap
`@fg/shared` SHALL export `MAX_HEARTBEAT_ENTRIES = 1440` next to the contracts, used by `HeartbeatRequest` and by the handler. After a valid envelope, a request with more than `MAX_HEARTBEAT_ENTRIES` entries SHALL respond `413 { "error": "too_many_entries" }` and write nothing, not even `last_seen_at`, so a client can tell "split the batch" from "malformed". The extension MUST send at most `MAX_HEARTBEAT_ENTRIES` entries per request, oldest first, in chunks.

#### Scenario: Exactly the cap
- **GIVEN** a valid token
- **WHEN** it sends a valid body with 1440 valid entries on distinct minutes
- **THEN** the response is `200`
- **AND** `upsertUsage` is called once with 1440 rows

#### Scenario: Above the cap
- **GIVEN** a valid token
- **WHEN** it sends a valid envelope with 1441 entries
- **THEN** the response is `413 { error: "too_many_entries" }`
- **AND** `upsertUsage` and `updateDevice` are never called

#### Scenario: Constant exported
- **GIVEN** `@fg/shared`
- **WHEN** `MAX_HEARTBEAT_ENTRIES` is imported
- **THEN** it equals `1440`
- **AND** `HeartbeatRequest` rejects 1441 entries and accepts 1440

### Requirement: Request log with counts only
For every request that passes authentication and the envelope and size checks, the handler SHALL call an injected `log` once with `{ accepted, skipped }`, both non-negative integers: stored entries (after de-duplication) and skipped entries. The log call SHALL carry no domains, tokens, device or child ids, or IP addresses.

#### Scenario: Logger receives counts only
- **GIVEN** a valid token and a logger that records calls
- **WHEN** it sends 2 valid entries and 1 with `seconds: 61`
- **THEN** the logger is called once with exactly `{ accepted: 2, skipped: 1 }`
- **AND** no argument contains a domain, `tok-1`, `dev-1` or an IP address

#### Scenario: No log for rejected requests
- **GIVEN** a logger that records calls
- **WHEN** a request gets `401`, `400` or `413`
- **THEN** the logger is not called

### Requirement: Idempotent usage storage
Each kept entry SHALL be stored as a `usage_minutes` row `{ device_id, minute_utc, domain, seconds }` of the authenticated device, upserted on `(device_id, minute_utc, domain)` so that sending the same minute again replaces `seconds` instead of adding. Within one request, the last entry for a `(minuteUtc, domain)` pair SHALL win. No other field SHALL be written to `usage_minutes`.

#### Scenario: Entries stored for the device
- **GIVEN** a valid token
- **WHEN** it sends entries `{2026-11-17T10:03:00Z, youtube.com, 40}` and `{2026-11-17T10:04:00Z, khanacademy.org, 60}`
- **THEN** the response is `200 { rulesVersion: 3 }`
- **AND** `upsertUsage` is called once with exactly the rows `{device_id: "dev-1", minute_utc: "2026-11-17T10:03:00.000Z", domain: "youtube.com", seconds: 40}` and `{device_id: "dev-1", minute_utc: "2026-11-17T10:04:00.000Z", domain: "khanacademy.org", seconds: 60}`
- **AND** every row has exactly the keys `device_id`, `minute_utc`, `domain`, `seconds`

#### Scenario: Duplicate entries in one request
- **GIVEN** a valid token
- **WHEN** it sends entries `{10:03:00Z, youtube.com, 20}` then `{10:03:00Z, youtube.com, 35}`
- **THEN** `upsertUsage` receives one row for that minute and domain with seconds `35`

#### Scenario: No entries
- **GIVEN** a valid token
- **WHEN** it sends a valid body with `entries: []`
- **THEN** the response is `200 { rulesVersion: 3 }`
- **AND** `upsertUsage` is not called

#### Scenario: Store upserts on the primary key
- **GIVEN** a fake Supabase client that records calls
- **WHEN** `createHeartbeatStore(fakeClient).upsertUsage(rows)` is called
- **THEN** the fake client records `from("usage_minutes")` and `upsert(rows, { onConflict: "device_id,minute_utc,domain" })`

#### Scenario: Resend replaces seconds in the database
- **GIVEN** the migrations are applied and a device exists
- **WHEN** the service role runs the same upsert statement twice for `(device, 2026-11-17T10:03:00Z, youtube.com)`, first with seconds `30`, then `45`
- **THEN** exactly one row exists for that key with seconds `45`

### Requirement: Invalid, stale, future and malformed entries are skipped
Every entry SHALL be validated on its own with `UsageEntry`. An entry SHALL be skipped, without error, when it fails `UsageEntry`, is older than the current UTC minute minus 7 days, is later than the current UTC minute plus 5 minutes (clock drift), is not a whole minute, or has a `domain` not matching `^[a-z0-9-]+(\.[a-z0-9-]+)+$`. The other entries SHALL be stored and the response SHALL be `200`.

#### Scenario: One invalid entry among valid ones
- **GIVEN** a valid token
- **WHEN** it sends entries `{2026-11-17T10:03:00Z, youtube.com, 40}`, `{2026-11-17T10:03:00Z, khanacademy.org, 61}` and `{2026-11-17T10:04:00Z, khanacademy.org, 60}`
- **THEN** the response is `200 { rulesVersion: 3 }`
- **AND** `upsertUsage` receives only the `youtube.com` and the `10:04:00` rows

#### Scenario: Seconds out of range
- **GIVEN** a valid token
- **WHEN** it sends entries for `youtube.com` at `10:03:00Z` with seconds `0`, `61`, `-5` and `1.5`, and one valid entry with seconds `60`
- **THEN** the response is `200`
- **AND** `upsertUsage` receives only the row with seconds `60`

#### Scenario: Non-ISO minute
- **GIVEN** a valid token
- **WHEN** it sends an entry with `minuteUtc` `"yesterday"`, one with `"2026-11-17 10:03"`, one with the number `1763373780`, and one valid entry
- **THEN** the response is `200`
- **AND** `upsertUsage` receives only the valid row

#### Scenario: Entry that is not an object
- **GIVEN** a valid token
- **WHEN** it sends `entries` `[null, "x", 5, {valid entry}]`
- **THEN** the response is `200` and only the valid entry is upserted

#### Scenario: Age and clock skew limits
- **GIVEN** a valid token and now `2026-11-17T10:05:30Z`
- **WHEN** it sends entries for `2026-11-10T10:05:00Z` (exactly 7 days before the minute of now), `2026-11-10T10:04:00Z` (older than 7 days), `2026-11-17T10:05:00Z` (current minute), `2026-11-17T10:10:00Z` (exactly 5 minutes ahead of the minute of now), `2026-11-17T10:11:00Z` (6 minutes ahead) and `2026-11-18T00:00:00Z` (a day ahead), all domain `youtube.com` seconds `10`
- **THEN** the response is `200 { rulesVersion: 3 }`
- **AND** `upsertUsage` receives only the rows for `2026-11-10T10:05:00.000Z`, `2026-11-17T10:05:00.000Z` and `2026-11-17T10:10:00.000Z`

#### Scenario: Not a whole minute
- **GIVEN** a valid token
- **WHEN** it sends an entry with `minuteUtc` `2026-11-17T10:03:30Z` and one with `2026-11-17T10:04:00Z`
- **THEN** only the `10:04:00` row is upserted

#### Scenario: Domain the database would reject
- **GIVEN** a valid token
- **WHEN** it sends entries with domains `localhost`, `YouTube.com`, `youtube.com/watch` and `youtube.com`
- **THEN** only the `youtube.com` row is upserted
- **AND** the response is `200`

#### Scenario: All entries skipped
- **GIVEN** a valid token
- **WHEN** it sends only an entry more than 5 minutes ahead
- **THEN** the response is `200`, `upsertUsage` is not called and `updateDevice` is called

### Requirement: Device status update
Every authenticated request with a valid envelope SHALL update the device with `last_seen_at` set to the server's now, `browser` and `extension_version` from the body, and nothing else. `currentDomain` SHALL NOT be stored anywhere. Store failures SHALL respond `500 { "error": "server_error" }`.

#### Scenario: Device updated
- **GIVEN** a valid token
- **WHEN** it sends a valid body with browser `edge`, extensionVersion `0.2.0` and currentDomain `youtube.com`
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
A `200` response SHALL be a valid `HeartbeatResponse` whose `rulesVersion` is the `children.rules_version` of the device's child. It SHALL start at 0 and increase when a block rule of that child, or a domain category override of the child's family, is inserted, updated or deleted. Global categories and other families' changes SHALL NOT change it.

#### Scenario: Response shape
- **GIVEN** a valid token
- **WHEN** it sends a valid body
- **THEN** `HeartbeatResponse.parse(response.body)` succeeds and equals `{ rulesVersion: 3 }`

#### Scenario: New child starts at 0
- **GIVEN** the migrations are applied
- **WHEN** the service role inserts a child
- **THEN** its `rules_version` is `0`

#### Scenario: Block rule changes bump the version
- **GIVEN** child C of family A with `rules_version` `v`
- **WHEN** parent A inserts a block rule for C, then updates it, then deletes it
- **THEN** after each statement C's `rules_version` is greater than before

#### Scenario: Deleting a child with rules
- **GIVEN** child C with block rules and a family with another child D
- **WHEN** parent A deletes C, cascading its block rules
- **THEN** the statement succeeds and D's `rules_version` is unchanged

#### Scenario: Family override bumps all children of the family only
- **GIVEN** family A with children C1 and C2, and family B with child D
- **WHEN** parent A inserts a domain category override for family A
- **THEN** the `rules_version` of C1 and C2 increased
- **AND** D's `rules_version` is unchanged

#### Scenario: Global category does not bump
- **GIVEN** children in families A and B
- **WHEN** the service role inserts a global domain category (`family_id` null)
- **THEN** no child's `rules_version` changes

#### Scenario: Override moved between families
- **GIVEN** a domain category override of family A and a child in each of families A and B
- **WHEN** the service role updates its `family_id` from A to B
- **THEN** the `rules_version` of the children of both A and B increased

#### Scenario: Other family's rule does not bump
- **GIVEN** family A with children C1 and C2, and family B with child D
- **WHEN** parent B inserts a block rule for child D
- **THEN** the `rules_version` of C1 and C2 is unchanged

### Requirement: Rules version written only by triggers
Parents SHALL NOT be able to insert or update `children.rules_version`, while other child columns stay writable under the existing RLS policies. The trigger functions SHALL NOT be executable by `public`, `anon` or `authenticated`.

#### Scenario: Parent cannot write rules_version
- **GIVEN** parent A of child C with `rules_version` `v`
- **WHEN** parent A runs `update children set rules_version = 99 where id = C`, then inserts a child with `rules_version` 5
- **THEN** both statements fail with a permission error
- **AND** C's `rules_version` is still `v`

#### Scenario: Parent can still rename a child
- **GIVEN** parent A of child C
- **WHEN** parent A updates C's `name` and `homework_categories`
- **THEN** the update succeeds and `rules_version` is unchanged
- **AND** parent A can still insert a child with `name` and `family_id`

#### Scenario: Trigger functions not executable by API roles
- **GIVEN** the migrations are applied
- **WHEN** roles `anon` and `authenticated` run `select public.bump_rules_version()` and `select public.bump_family_rules_version()`
- **THEN** each statement fails with a permission error
- **AND** `has_function_privilege` for `public`, `anon` and `authenticated` on both functions is false
- **AND** block rule and category changes by a parent still bump the version

### Requirement: Extension version column
`devices` SHALL have a nullable `extension_version` column of at most 32 characters that parents can read. ADR 0005 (amendment 2026-11-17) allows storing it.

#### Scenario: Column constraint and privilege
- **GIVEN** the migrations are applied and a device of parent A's child exists
- **WHEN** the service role sets `extension_version` to a 33-character string
- **THEN** the update fails with a check violation
- **AND** setting `0.2.0` succeeds
- **AND** parent A can run `select extension_version from devices` and sees `0.2.0` for their device
- **AND** parent A still cannot select `token_hash`

### Requirement: Shared helpers
`hashDeviceToken` in `apps/web/src/lib/device/token.ts` (SHA-256, lowercase hex) SHALL be the only device token hash helper, and `apps/web/src/lib/supabase/admin.ts` SHALL import `server-only`. Whichever of this change and change #9 (PR #36) is built first creates these files; the other reuses them.

#### Scenario: Single hash helper
- **GIVEN** the source of `apps/web/src`
- **WHEN** it is searched for `createHash("sha256")`
- **THEN** it appears only in `lib/device/token.ts`
- **AND** the first import of `lib/supabase/admin.ts` is `server-only`

### Requirement: The heartbeat response carries the child's other devices' usage
A `200` response SHALL include `otherUsage` `{ day, seconds }`: today's date in the family timezone and today's seconds per category (domains mapped with the seed and family overrides) of the child's other devices, excluding the caller, with no domains. The handler SHALL add it only when it passes `OtherUsage.safeParse`; if it cannot be computed or is invalid the response SHALL still be `200` without it.

#### Scenario: Other device seconds by category
File: `apps/web/src/lib/device/heartbeat.test.ts`
- **GIVEN** a valid token and a fake store whose `otherUsage` returns `{ day: "2026-11-17", seconds: { games: 600 } }`
- **WHEN** a valid body is sent
- **THEN** the response is `200` with `rulesVersion` `3` and `otherUsage` equal to that value, and the body contains no domain

#### Scenario: Computation fails
File: `apps/web/src/lib/device/heartbeat.test.ts`
- **GIVEN** a fake store whose `otherUsage` throws
- **WHEN** a valid body is sent
- **THEN** the response is `200 { rulesVersion: 3 }` and the entries were still stored

#### Scenario: Invalid value is omitted
File: `apps/web/src/lib/device/heartbeat.test.ts`
- **GIVEN** a fake store whose `otherUsage` returns `{ day: "x", seconds: { games: -1 } }`
- **WHEN** a valid body is sent
- **THEN** the response is `200 { rulesVersion: 3 }` without `otherUsage`

### Requirement: One SQL function computes the other devices' usage
`public.device_other_usage(p_device_id)` SHALL take only the device id, read the family timezone itself (`UTC` when unset, as `findChild`), and return the `day` with the per-domain sums so both share one clock. It SHALL return at most 1000 rows ordered by seconds descending, and be executable by `service_role` only (revoked from `public`, `anon` and `authenticated`).

#### Scenario: Excludes the calling device and sums the others in the family timezone
File: `supabase/tests/cross-browser-usage.test.ts`
- **GIVEN** a child with devices A, B and C, `roblox.com` 120 s on A, 300 s on B and 60 s on C today, `roblox.com` 500 s yesterday on B, timezone `Asia/Ho_Chi_Minh`, and a second child's device with 900 s
- **WHEN** `device_other_usage(A)` runs as the service role
- **THEN** every row has `day` equal to today in that timezone, and `roblox.com` has 360 s, with nothing from yesterday or the other child

#### Scenario: Day rollover in the family timezone
File: `supabase/tests/cross-browser-usage.test.ts`
- **GIVEN** B has `roblox.com` 60 s at `2026-11-17T16:59:00Z` and 30 s at `2026-11-17T17:00:00Z`, timezone `Asia/Ho_Chi_Minh`, and now is `2026-11-17T17:00:30Z`
- **WHEN** `device_other_usage(A)` runs
- **THEN** it returns `day` `2026-11-18` and 30 s only

#### Scenario: Defaults and caps
File: `supabase/tests/cross-browser-usage.test.ts`
- **GIVEN** a family without a timezone and B with 1200 distinct domains today, then a child whose other devices have no usage
- **WHEN** `device_other_usage(A)` runs
- **THEN** `day` is the UTC date, at most 1000 rows come back with the highest seconds first, and with no usage one row has a null `domain`, 0 seconds and today's `day`

#### Scenario: Permissions
File: `supabase/tests/cross-browser-usage.test.ts`
- **WHEN** the function is called as `anon` and as an authenticated parent
- **THEN** both are denied, and the service role is allowed
