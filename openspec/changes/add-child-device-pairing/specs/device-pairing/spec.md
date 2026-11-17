# Spec Delta

## Purpose

A parent gets a short-lived, single-use code for a child; the browser extension trades it for a device token through `POST /api/device/pair`. Only the token hash is stored; brute force is rate limited.

Test files:
- `packages/shared/src/pairing.test.ts`: code helpers and zod contracts.
- `apps/web/src/lib/pairing/create-code.test.ts`: code creation and collision retry with a fake Supabase client.
- `apps/web/src/components/children-list.test.ts`: code and error display.
- `apps/web/src/lib/pairing/pair-device.test.ts`: endpoint logic with fake `registerAttempt` / `redeem` deps.
- `supabase/tests/pairing.test.ts`: the migration's table and functions, on the PGlite harness from issue #7 (`asService`, `asParent`, `asAnon`).

## ADDED Requirements

### Requirement: Pairing code format
`generatePairingCode(randomBytes)` SHALL return 6 characters from `PAIRING_ALPHABET` = `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0`, `O`, `1`, `I`), using `byte % 32` per character. `normalizePairingCode(input)` SHALL uppercase, strip spaces and `-`, and return the code if it is 6 alphabet characters, else `null`.

#### Scenario: Alphabet has no ambiguous characters
- **WHEN** a test reads `PAIRING_ALPHABET` (`pairing.test.ts`)
- **THEN** it has 32 distinct characters, all matching `[A-Z0-9]`, none of `0`, `O`, `1`, `I`

#### Scenario: Deterministic mapping
- **GIVEN** a `randomBytes` stub returning `[0, 31, 32, 255, 8, 100]`
- **WHEN** `generatePairingCode(stub)` is called (`pairing.test.ts`)
- **THEN** it returns `"A9A9JE"`

#### Scenario: Default source gives valid codes
- **WHEN** `generatePairingCode()` is called 1000 times (`pairing.test.ts`)
- **THEN** every result matches `^[A-HJ-NP-Z2-9]{6}$`

#### Scenario: Normalisation
- **WHEN** `normalizePairingCode` is called with `" ab2-cd3 "`, `"AB2CD"`, `"AB2CD0"`, `"AB2CDOO"` (`pairing.test.ts`)
- **THEN** it returns `"AB2CD3"`, `null`, `null`, `null`

### Requirement: Pair contracts send only browser and OS
`PairRequest` SHALL accept exactly `code` (string, max 32), `browser` (`chrome`, `edge`, `brave`, `other`) and `os` (1..32 chars), and strip any other field. `PairResponse` SHALL be `{ deviceToken: string }`.

#### Scenario: Valid request
- **WHEN** `PairRequest.parse({ code: "AB2CD3", browser: "edge", os: "Windows", url: "https://x.com/a" })` runs (`pairing.test.ts`)
- **THEN** it returns `{ code: "AB2CD3", browser: "edge", os: "Windows" }` with no `url` key

#### Scenario: Invalid request
- **WHEN** `PairRequest.safeParse` runs on `{ code: "AB2CD3", browser: "firefox", os: "Windows" }` and on `{ code: "AB2CD3", browser: "edge", os: "" }` (`pairing.test.ts`)
- **THEN** both fail

### Requirement: Create a pairing code valid for 1 hour
`createPairingCode(client, childId, { now, generate })` SHALL insert `{ code, child_id: childId, expires_at: now + 1 hour }` into `pairing_codes` with the parent's client and return `{ ok: true, code, expiresAt }`.

#### Scenario: Code created
- **GIVEN** `now` = `2026-11-17T10:00:00Z`, `generate` returning `"AB2CD3"` and a fake client whose insert succeeds
- **WHEN** `createPairingCode(client, "child-1", ...)` is called (`create-code.test.ts`)
- **THEN** it returns `{ ok: true, code: "AB2CD3", expiresAt: "2026-11-17T11:00:00.000Z" }`
- **AND** one insert into `pairing_codes` was made with `{ code: "AB2CD3", child_id: "child-1", expires_at: "2026-11-17T11:00:00.000Z" }`

### Requirement: Collision with a code in use
On a `"23505"` insert error, `createPairingCode` SHALL retry with a new random code at most 3 times without reading or overwriting the existing code, then return reason `in-use`. Other errors SHALL return reason `failed` without retry. A colliding `customCode` SHALL return reason `custom-in-use` without retry.

#### Scenario: Retry after a collision
- **GIVEN** `generate` returning `"AAAAAA"` then `"BBBBBB"`, and a fake client whose first insert resolves `{ error: { code: "23505" } }` and second succeeds
- **WHEN** `createPairingCode` is called (`create-code.test.ts`)
- **THEN** it returns `{ ok: true, code: "BBBBBB", ... }`
- **AND** exactly two inserts were made, and the client made no update, upsert, delete or select on `pairing_codes`

#### Scenario: Gives up after 3 retries
- **GIVEN** a fake client whose every insert resolves `{ error: { code: "23505" } }`
- **WHEN** `createPairingCode` is called (`create-code.test.ts`)
- **THEN** it returns `{ ok: false, reason: "in-use" }`
- **AND** exactly 4 inserts were made, each with a fresh `generate()` result

#### Scenario: Other errors are not retried
- **GIVEN** a fake client whose insert resolves `{ error: { code: "42501" } }`
- **WHEN** `createPairingCode` is called (`create-code.test.ts`)
- **THEN** it returns `{ ok: false, reason: "failed" }` after exactly one insert

#### Scenario: Custom code in use
- **GIVEN** a fake client whose insert resolves `{ error: { code: "23505" } }`
- **WHEN** `createPairingCode(client, "child-1", { ..., customCode: "MYCODE" })` is called (`create-code.test.ts`)
- **THEN** it returns `{ ok: false, reason: "custom-in-use" }` after exactly one insert with code `"MYCODE"`
- **AND** `PAIRING_ERROR_MESSAGES["custom-in-use"]` equals `"This code is already in use, please choose another"`

### Requirement: Code and collision error shown on the children page
`ChildrenList` SHALL show a child's active code from `activeCodes` with its expiry time. For `pairError` with reason `in-use` it SHALL show `PAIRING_ERROR_MESSAGES["in-use"]` next to that child and a "Generate another code" button.

#### Scenario: Active code shown
- **WHEN** a test renders `ChildrenList` with child `c1` "Minh" and `activeCodes` `{ c1: { code: "AB2CD3", expiresAt: "2026-11-17T11:00:00.000Z" } }` (`children-list.test.ts`)
- **THEN** the markup contains `AB2CD3` and the text "Valid until"

#### Scenario: In-use error with generate-another button
- **WHEN** a test renders `ChildrenList` with child `c1` and `pairError` `{ childId: "c1", reason: "in-use" }` (`children-list.test.ts`)
- **THEN** the markup contains `PAIRING_ERROR_MESSAGES["in-use"]` and a button with text "Generate another code"

### Requirement: Pair a device with a valid code
`pairDevice(deps, ip, body)` SHALL, for a valid request and code, create a random device token of 32 bytes encoded as base64url, call `deps.redeem(code, sha256Hex(token), browser, os)`, and return `200 { deviceToken: token }`. The token SHALL NOT be passed to `redeem` or any other dep; only its hash is.

#### Scenario: Successful pairing
- **GIVEN** `registerAttempt` returning `1` and `redeem` returning `"device-1"`
- **WHEN** `pairDevice(deps, "203.0.113.5", { code: " ab2-cd3 ", browser: "chrome", os: "Windows" })` is called (`pair-device.test.ts`)
- **THEN** the status is `200` and `body.deviceToken` matches `^[A-Za-z0-9_-]{43}$`
- **AND** `redeem` was called once with `("AB2CD3", sha256Hex(body.deviceToken), "chrome", "Windows")`
- **AND** no argument passed to any dep equals the token

#### Scenario: Tokens are random
- **WHEN** two successful pairings run (`pair-device.test.ts`)
- **THEN** the two tokens differ

### Requirement: Invalid, expired and used codes look the same
For a code that is malformed, unknown, expired or already used, `pairDevice` SHALL return `400 { error: "invalid_code" }`, identical in every case. A body that fails `PairRequest` SHALL return `400 { error: "invalid_request" }`. A dep error SHALL return `500 { error: "server_error" }` without the error text.

#### Scenario: Same response for every bad code
- **GIVEN** `redeem` returning `null`
- **WHEN** `pairDevice` is called with code `"ZZZZZZ"` (unknown/expired/used, all `null` from `redeem`) and with code `"AB2CD0"` (malformed; `redeem` not called) (`pair-device.test.ts`)
- **THEN** both return status `400` and a body deep-equal to `{ error: "invalid_code" }`

#### Scenario: Malformed body
- **WHEN** `pairDevice` is called with `{ code: "AB2CD3", browser: "firefox", os: "Windows" }` and with `null` (`pair-device.test.ts`)
- **THEN** each returns `400 { error: "invalid_request" }` and `redeem` was not called

#### Scenario: Dependency failure
- **GIVEN** `redeem` throwing `Error("db down")`
- **WHEN** `pairDevice` is called with a valid request (`pair-device.test.ts`)
- **THEN** it returns `500 { error: "server_error" }` and the body does not contain `db down`

### Requirement: Rate limit per IP
`pairDevice` SHALL call `deps.registerAttempt(sha256Hex(ip))` before parsing the body and return `429 { error: "rate_limited" }` without calling `redeem` when the returned count exceeds 10. `clientIp(headers)` SHALL return the first trimmed entry of `x-forwarded-for`, else `x-real-ip`, else `"unknown"`.

#### Scenario: Eleventh attempt is refused
- **GIVEN** `registerAttempt` returning `10`, then `11`
- **WHEN** `pairDevice` is called twice with a valid request (`pair-device.test.ts`)
- **THEN** the first returns `200` and the second returns `429 { error: "rate_limited" }`
- **AND** `redeem` was called exactly once
- **AND** `registerAttempt` received a 64-character lowercase hex string, not the raw IP

#### Scenario: Malformed requests count too
- **GIVEN** `registerAttempt` returning `11`
- **WHEN** `pairDevice` is called with body `null` (`pair-device.test.ts`)
- **THEN** it returns `429` and `registerAttempt` was called once

#### Scenario: Client IP header
- **WHEN** `clientIp` is called with `x-forwarded-for: "203.0.113.5, 10.0.0.1"`, with only `x-real-ip: "198.51.100.7"`, and with no headers (`pair-device.test.ts`)
- **THEN** it returns `"203.0.113.5"`, `"198.51.100.7"` and `"unknown"`

### Requirement: Single-use redeem in the database
The migration SHALL add `public.redeem_pairing_code(p_code, p_token_hash, p_browser, p_os) returns uuid`, which deletes the matching unexpired `pairing_codes` row and inserts a `devices` row for its child with `token_hash = p_token_hash`, in one transaction, returning the device id, or `null` when no unexpired row matches. Only `service_role` SHALL be able to execute it.

#### Scenario: Redeem creates a device and consumes the code
- **GIVEN** a child of family A with code `AB2CD3` expiring in one hour
- **WHEN** the service role calls `redeem_pairing_code('AB2CD3', <64 hex>, 'edge', 'Windows')` (`pairing.test.ts`)
- **THEN** it returns a uuid, a `devices` row with that id has the child's `child_id`, browser `edge`, os `Windows` and the given `token_hash`
- **AND** no `pairing_codes` row `AB2CD3` remains

#### Scenario: Second use and expired code return null
- **WHEN** the service role calls `redeem_pairing_code('AB2CD3', ...)` again, then for a code whose `expires_at` is in the past, then for an unknown code (`pairing.test.ts`)
- **THEN** each returns `null` and the number of `devices` rows is unchanged
- **AND** the expired row is still present (redeem does not touch expired codes)

#### Scenario: Only the service role may redeem
- **WHEN** parent A (`asParent`) and `anon` call `redeem_pairing_code` with a valid code (`pairing.test.ts`)
- **THEN** each fails with a permission error and the code is still present

### Requirement: Rate-limit storage in the database
The migration SHALL add `pair_attempts(id, ip_hash, at)` with RLS enabled and no policies, `ip_hash` checked against `^[0-9a-f]{64}$`, and `public.register_pair_attempt(p_ip_hash) returns int` (service role only) which deletes all attempts older than 10 minutes, records one attempt and returns the number of attempts for that hash in the last 10 minutes.

#### Scenario: Counting per hash
- **WHEN** the service role calls `register_pair_attempt` three times with hash `H1` and once with hash `H2` (`pairing.test.ts`)
- **THEN** the calls return `1`, `2`, `3` and `1`

#### Scenario: Old attempts are purged and not counted
- **GIVEN** a `pair_attempts` row for `H1` with `at` 11 minutes ago and one for `H2` with `at` 11 minutes ago
- **WHEN** the service role calls `register_pair_attempt(H1)` (`pairing.test.ts`)
- **THEN** it returns `1` and no row older than 10 minutes remains for any hash

#### Scenario: Raw IPs and outsiders rejected
- **WHEN** the service role inserts a `pair_attempts` row with `ip_hash` `203.0.113.5`, and parent A and `anon` select from `pair_attempts` and call `register_pair_attempt` (`pairing.test.ts`)
- **THEN** the insert fails with a check violation, the selects return no rows or fail, and the calls fail with a permission error
