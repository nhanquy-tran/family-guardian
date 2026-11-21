# device-pairing Specification

## Purpose
A parent gets a short-lived, single-use code for a child; the browser extension trades it for a device token through `POST /api/device/pair`. Only the token hash is stored; brute force is rate limited.

Test files:
- `packages/shared/src/pairing.test.ts`: code helpers and zod contracts.
- `apps/web/src/lib/pairing/create-code.test.ts`: code creation and collision retry with a fake Supabase client.
- `apps/web/src/components/children-list.test.ts`: code and error display.
- `apps/web/src/lib/pairing/pair-device.test.ts`: endpoint logic with fake `hashIp` / `registerAttempt` / `redeem` deps.
- `apps/web/src/app/api/device/pair/route.test.ts`: route wiring, with `@/lib/supabase/admin` mocked.
- `apps/web/src/lib/supabase/admin.test.ts`: server-only guard and RPC error mapping.
- `supabase/tests/pairing.test.ts`: the migration's table and functions, on the PGlite harness from issue #7 (`asService`, `asParent`, `asAnon`).

## Requirements

### Requirement: Pairing code format
`generatePairingCode(randomBytes)` SHALL return 6 characters from `PAIRING_ALPHABET` = `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0`, `O`, `1`, `I`), using `byte % 32` per character. `normalizePairingCode(input)` SHALL uppercase, strip spaces and `-`, and return the code if it is 6 alphabet characters, else `null`.

#### Scenario: Alphabet has no ambiguous characters
- **GIVEN** the exported `PAIRING_ALPHABET`
- **WHEN** a test reads `PAIRING_ALPHABET` (`pairing.test.ts`)
- **THEN** it has 32 distinct characters, all matching `[A-Z0-9]`, none of `0`, `O`, `1`, `I`

#### Scenario: Deterministic mapping
- **GIVEN** a `randomBytes` stub returning `[0, 31, 32, 255, 8, 100]`
- **WHEN** `generatePairingCode(stub)` is called (`pairing.test.ts`)
- **THEN** it returns `"A9A9JE"`

#### Scenario: Default source gives valid codes
- **GIVEN** no `randomBytes` argument, so the default crypto source is used
- **WHEN** `generatePairingCode()` is called 1000 times (`pairing.test.ts`)
- **THEN** every result matches `^[A-HJ-NP-Z2-9]{6}$`

#### Scenario: Normalisation
- **GIVEN** raw user input with spaces, dashes, lowercase, wrong length and ambiguous characters
- **WHEN** `normalizePairingCode` is called with `" ab2-cd3 "`, `"AB2CD"`, `"AB2CD0"`, `"AB2CDOO"` (`pairing.test.ts`)
- **THEN** it returns `"AB2CD3"`, `null`, `null`, `null`

### Requirement: Pair contracts send only browser and OS
`PairRequest` SHALL accept exactly `code` (string, max 32), `browser` (`chrome`, `edge`, `brave`, `firefox`, `other`) and `os` (1..32 chars), and strip any other field. `PairResponse` SHALL be `{ deviceToken: string }`.

#### Scenario: Valid request
- **GIVEN** a request object with an extra `url` field
- **WHEN** `PairRequest.parse({ code: "AB2CD3", browser: "edge", os: "Windows", url: "https://x.com/a" })` runs (`pairing.test.ts`)
- **THEN** it returns `{ code: "AB2CD3", browser: "edge", os: "Windows" }` with no `url` key
- **AND** `PairRequest.parse({ code: "AB2CD3", browser: "firefox", os: "Windows" })` returns `{ code: "AB2CD3", browser: "firefox", os: "Windows" }`

#### Scenario: Invalid request
- **GIVEN** one request with an unsupported browser and one with an empty `os`
- **WHEN** `PairRequest.safeParse` runs on `{ code: "AB2CD3", browser: "netscape", os: "Windows" }` and on `{ code: "AB2CD3", browser: "edge", os: "" }` (`pairing.test.ts`)
- **THEN** both fail

### Requirement: Create a pairing code valid for 1 hour
`createPairingCode(client, childId, { now, generate })` SHALL insert `{ code, child_id: childId, expires_at: now + 1 hour }` into `pairing_codes` (after deleting the child's earlier codes) with the parent's client and return `{ ok: true, code, expiresAt }`.

#### Scenario: Code created
- **GIVEN** `now` = `2026-11-17T10:00:00Z`, `generate` returning `"AB2CD3"` and a fake client whose insert succeeds
- **WHEN** `createPairingCode(client, "child-1", ...)` is called (`create-code.test.ts`)
- **THEN** it returns `{ ok: true, code: "AB2CD3", expiresAt: "2026-11-17T11:00:00.000Z" }`
- **AND** one insert into `pairing_codes` was made with `{ code: "AB2CD3", child_id: "child-1", expires_at: "2026-11-17T11:00:00.000Z" }`

### Requirement: A new code supersedes the child's earlier codes
`createPairingCode` SHALL first delete all earlier `pairing_codes` rows of that child with the parent's client (RLS applies), then insert the new code. If the delete returns an error it SHALL return `{ ok: false, reason: "failed" }` and SHALL NOT insert. A child therefore has at most one code that can be redeemed.

#### Scenario: Earlier codes are deleted before the insert
- **GIVEN** a fake client that records calls in order and an insert that succeeds
- **WHEN** `createPairingCode(client, "child-1", ...)` is called (`create-code.test.ts`)
- **THEN** the first recorded call is `from("pairing_codes").delete().eq("child_id", "child-1")` and the insert comes after it
- **AND** no delete or select targets another child

#### Scenario: Failed delete of earlier codes does not insert
- **GIVEN** a fake client whose `pairing_codes` delete resolves a non-null `error` and records every call
- **WHEN** `createPairingCode(client, "child-1", ...)` is called (`create-code.test.ts`)
- **THEN** it returns `{ ok: false, reason: "failed" }`
- **AND** no insert into `pairing_codes` was made, so no second valid code exists

#### Scenario: Old code A stops working when B is generated
- **GIVEN** family A's child has active code `AAAAAA` and the service role can call `redeem_pairing_code` (`pairing.test.ts`, parent client via `asParent`)
- **WHEN** parent A generates a new code `BBBBBB` for the same child by deleting the child's codes and inserting `BBBBBB`, as `createPairingCode` does
- **THEN** `redeem_pairing_code('AAAAAA', ...)` returns `null`
- **AND** `redeem_pairing_code('BBBBBB', ...)` returns a device id

#### Scenario: A parent cannot delete another family's codes
- **GIVEN** a code `CCCCCC` of a child of family B (`pairing.test.ts`)
- **WHEN** parent A deletes `pairing_codes` where `child_id` is family B's child
- **THEN** no row is deleted and `CCCCCC` is still redeemable

### Requirement: Collision with a code in use
On a `"23505"` insert error, `createPairingCode` SHALL retry with a new random code at most 3 times without reading or overwriting the existing code, then return reason `in-use`. Other errors SHALL return reason `failed` without retry. A colliding `customCode` SHALL return reason `custom-in-use` without retry.

#### Scenario: Retry after a collision
- **GIVEN** `generate` returning `"AAAAAA"` then `"BBBBBB"`, and a fake client whose first insert resolves `{ error: { code: "23505" } }` and second succeeds
- **WHEN** `createPairingCode` is called (`create-code.test.ts`)
- **THEN** it returns `{ ok: true, code: "BBBBBB", ... }`
- **AND** exactly two inserts were made, and the client made no update, upsert or select on `pairing_codes`, and its only delete was the single initial delete of the child's earlier codes, not repeated on retry

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
- **GIVEN** child `c1` "Minh" and `activeCodes` `{ c1: { code: "AB2CD3", expiresAt: "2026-11-17T11:00:00.000Z" } }`
- **WHEN** a test renders `ChildrenList` (`children-list.test.ts`)
- **THEN** the markup contains `AB2CD3` and the text "Valid until"

#### Scenario: In-use error with generate-another button
- **GIVEN** child `c1` and `pairError` `{ childId: "c1", reason: "in-use" }`
- **WHEN** a test renders `ChildrenList` (`children-list.test.ts`)
- **THEN** the markup contains `PAIRING_ERROR_MESSAGES["in-use"]` and a button with text "Generate another code"

### Requirement: Pair a device with a valid code
`pairDevice(deps, ip, body)` SHALL, for a valid request and code, create a random device token of 32 bytes encoded as base64url, call `deps.redeem(code, hashDeviceToken(token), browser, os)`, and return `200 { deviceToken: token }`. The token SHALL NOT be passed to `redeem` or any other dep; only its hash is.

#### Scenario: Successful pairing
- **GIVEN** `registerAttempt` returning `1` and `redeem` returning `"device-1"`
- **WHEN** `pairDevice(deps, "203.0.113.5", { code: " ab2-cd3 ", browser: "chrome", os: "Windows" })` is called (`pair-device.test.ts`)
- **THEN** the status is `200` and `body.deviceToken` matches `^[A-Za-z0-9_-]{43}$`
- **AND** `redeem` was called once with `("AB2CD3", hashDeviceToken(body.deviceToken), "chrome", "Windows")`
- **AND** no argument passed to any dep equals the token

#### Scenario: Tokens are random
- **GIVEN** `registerAttempt` returning `1` and `redeem` returning a device id
- **WHEN** two successful pairings run (`pair-device.test.ts`)
- **THEN** the two tokens differ

### Requirement: Invalid, expired and used codes look the same
For a code that is malformed, unknown, expired or already used, `pairDevice` SHALL return `400 { error: "invalid_code" }`, identical in every case. A body that fails `PairRequest` SHALL return `400 { error: "invalid_request" }`. A dep error SHALL return `500 { error: "server_error" }` without the error text.

#### Scenario: Same response for every bad code
- **GIVEN** `registerAttempt` returning `1` and `redeem` returning `null`
- **WHEN** `pairDevice` is called with code `"ZZZZZZ"` (unknown/expired/used, all `null` from `redeem`) and with code `"AB2CD0"` (malformed; `redeem` not called) (`pair-device.test.ts`)
- **THEN** both return status `400` and a body deep-equal to `{ error: "invalid_code" }`

#### Scenario: Malformed body
- **GIVEN** `registerAttempt` returning `1`
- **WHEN** `pairDevice` is called with `{ code: "AB2CD3", browser: "netscape", os: "Windows" }` and with `null` (`pair-device.test.ts`)
- **THEN** each returns `400 { error: "invalid_request" }` and `redeem` was not called

#### Scenario: Dependency failure
- **GIVEN** `registerAttempt` returning `1` and `redeem` throwing `Error("db down")`
- **WHEN** `pairDevice` is called with a valid request (`pair-device.test.ts`)
- **THEN** it returns `500 { error: "server_error" }` and the body does not contain `db down`

### Requirement: Rate limit per IP
`pairDevice` SHALL call `deps.registerAttempt(deps.hashIp(ip))` before parsing the body, where `hashIp` is `hmacSha256Hex(PAIR_RATE_LIMIT_SECRET, ip)` (64 lowercase hex characters), and return `429 { error: "rate_limited" }` without calling `redeem` when the count exceeds 10.

#### Scenario: Eleventh attempt is refused
- **GIVEN** `hashIp` backed by `hmacSha256Hex("test-secret", ip)` and `registerAttempt` returning `10`, then `11`
- **WHEN** `pairDevice` is called twice with a valid request (`pair-device.test.ts`)
- **THEN** the first returns `200` and the second returns `429 { error: "rate_limited" }`
- **AND** `redeem` was called exactly once
- **AND** `registerAttempt` received a 64-character lowercase hex string equal to `hmacSha256Hex("test-secret", "203.0.113.5")`, which differs from the raw IP and from `hashDeviceToken("203.0.113.5")`

#### Scenario: Malformed requests count too
- **GIVEN** `registerAttempt` returning `11`
- **WHEN** `pairDevice` is called with body `null` (`pair-device.test.ts`)
- **THEN** it returns `429` and `registerAttempt` was called once

### Requirement: Client IP from forwarding headers
`clientIp(headers, warn)` SHALL return the first trimmed `x-forwarded-for` entry, else `x-real-ip`, else `"unknown"`, and in the last case call `warn` once with a message that contains no IP. The shared `unknown` bucket is still rate limited and is accepted for Vercel-only deployment (ADR 0012).

#### Scenario: Client IP header
- **GIVEN** a `warn` spy
- **WHEN** `clientIp` is called with `x-forwarded-for: "203.0.113.5, 10.0.0.1"`, with only `x-real-ip: "198.51.100.7"`, and with no headers (`pair-device.test.ts`)
- **THEN** it returns `"203.0.113.5"`, `"198.51.100.7"` and `"unknown"`
- **AND** `warn` was called exactly once, for the no-headers call

#### Scenario: No forwarding headers warns without the IP and is still limited
- **GIVEN** a request with no `x-forwarded-for` and no `x-real-ip`, a `warn` spy, and `registerAttempt` returning `11`
- **WHEN** the request is handled by `clientIp` then `pairDevice` (`pair-device.test.ts`)
- **THEN** `registerAttempt` was called with `hmacSha256Hex(secret, "unknown")` and the response is `429 { error: "rate_limited" }`
- **AND** the warning text contains no digit-dot IP address and no header value

### Requirement: Fail closed when the limiter or its secret fails
If `hashIp` or `registerAttempt` throws or returns an error, or `PAIR_RATE_LIMIT_SECRET` is missing or empty, `pairDevice` and the route SHALL return `500 { error: "server_error" }`, SHALL NOT call `redeem`, SHALL NOT fall back to a plain hash of the IP, and the body SHALL NOT contain the error text.

#### Scenario: registerAttempt throws or rejects
- **GIVEN** `registerAttempt` throwing `Error("limiter down")`, and in a second case returning a rejected promise (how `admin.ts` maps an RPC error), and a `redeem` spy
- **WHEN** `pairDevice` is called with a valid request (`pair-device.test.ts`)
- **THEN** in both cases it returns `500 { error: "server_error" }` and the body does not contain `limiter down`
- **AND** `redeem` was not called

#### Scenario: HMAC secret missing
- **GIVEN** `PAIR_RATE_LIMIT_SECRET` unset (and, in a second case, set to `""`), and a `registerAttempt` spy
- **WHEN** the deps are built through `admin.ts` and `pairDevice` is called with a valid request (`admin.test.ts`, `route.test.ts`)
- **THEN** the route returns `500 { error: "server_error" }` and the body does not contain the variable value
- **AND** `hashIp` throws, `registerAttempt` is not called and `redeem` is not called

#### Scenario: RPC error becomes a thrown error
- **GIVEN** a fake service-role client whose `rpc("register_pair_attempt")` resolves `{ data: null, error: { message: "boom" } }`
- **WHEN** `deps.registerAttempt("a".repeat(64))` from `admin.ts` is called (`admin.test.ts`)
- **THEN** it rejects, and the same holds for `rpc("redeem_pairing_code")`

### Requirement: Route wiring and service-role key stay server-side
`app/api/device/pair/route.ts` SHALL pass `clientIp(request.headers, console.warn)` to `pairDevice` and return its status and body as JSON. `src/lib/supabase/admin.ts` SHALL start with `import "server-only"` and read `SUPABASE_SERVICE_ROLE_KEY` and `PAIR_RATE_LIMIT_SECRET` only from server environment variables. No file with `"use client"`, nothing under `src/components`, and nothing in `packages/shared` or `apps/extension` SHALL import `admin.ts` or mention those variable names.

#### Scenario: clientIp is used for the limiter
- **GIVEN** `admin.ts` mocked with a `registerAttempt` spy, secret `"test-secret"`, and a `POST` request with `x-forwarded-for: "203.0.113.5, 10.0.0.1"` and a valid body
- **WHEN** the route's `POST` handler runs (`route.test.ts`)
- **THEN** `registerAttempt` was called once with `hmacSha256Hex("test-secret", "203.0.113.5")`
- **AND** the response status and JSON equal what `pairDevice` returned

#### Scenario: admin.ts is server-only
- **GIVEN** the source text of `src/lib/supabase/admin.ts`
- **WHEN** a test reads it (`admin.test.ts`)
- **THEN** its first statement is `import "server-only"`
- **AND** it is the only file under `apps/web/src` that mentions `SUPABASE_SERVICE_ROLE_KEY`, other than tests

#### Scenario: Client code does not import the service-role client
- **GIVEN** all source files under `apps/web/src/components`, every file in `apps/web/src` that starts with `"use client"`, `packages/shared/src` and `apps/extension`
- **WHEN** a test scans their text (`admin.test.ts`)
- **THEN** none imports `supabase/admin` and none contains `SUPABASE_SERVICE_ROLE_KEY` or `PAIR_RATE_LIMIT_SECRET`

#### Scenario: Secret name is documented, value is not
- **GIVEN** `apps/web/.env.example`
- **WHEN** a test reads it (`admin.test.ts`)
- **THEN** it contains the line `PAIR_RATE_LIMIT_SECRET=` with an empty value

### Requirement: Single-use redeem in the database
The migration SHALL add `public.redeem_pairing_code(p_code, p_token_hash, p_browser, p_os) returns uuid`, which deletes the matching unexpired `pairing_codes` row and inserts a `devices` row for its child with `token_hash = p_token_hash`, in one transaction, returning the device id, or `null` when no unexpired row matches. Only `service_role` SHALL be able to execute it.

#### Scenario: Redeem creates a device and consumes the code
- **GIVEN** a child of family A with code `AB2CD3` expiring in one hour
- **WHEN** the service role calls `redeem_pairing_code('AB2CD3', <64 hex>, 'edge', 'Windows')` (`pairing.test.ts`)
- **THEN** it returns a uuid, a `devices` row with that id has the child's `child_id`, browser `edge`, os `Windows` and the given `token_hash`
- **AND** no `pairing_codes` row `AB2CD3` remains

#### Scenario: Second use and expired code return null
- **GIVEN** code `AB2CD3` was already redeemed, an expired code row exists and one unknown code is used
- **WHEN** the service role calls `redeem_pairing_code('AB2CD3', ...)` again, then for a code whose `expires_at` is in the past, then for an unknown code (`pairing.test.ts`)
- **THEN** each returns `null` and the number of `devices` rows is unchanged
- **AND** the expired row is still present (redeem does not touch expired codes)

#### Scenario: Only the service role may redeem
- **GIVEN** a valid unexpired code of family A's child
- **WHEN** parent A (`asParent`) and `anon` call `redeem_pairing_code` with a valid code (`pairing.test.ts`)
- **THEN** each fails with a permission error and the code is still present

### Requirement: Rate-limit storage in the database
The migration SHALL add `pair_attempts(id, ip_hash, at)` with RLS enabled and no policies, `ip_hash` checked against `^[0-9a-f]{64}$` (HMAC only), `purge_pair_attempts()` deleting attempts older than 10 minutes, and `register_pair_attempt(p_ip_hash) returns int` which purges, records one attempt and returns that hash's count for the last 10 minutes. Both functions are service role only. A daily `pg_cron` job `purge-pair-attempts` SHALL also run the purge (ADR 0012).

#### Scenario: Counting per hash
- **GIVEN** an empty `pair_attempts` table and two distinct 64-hex hashes `H1` and `H2`
- **WHEN** the service role calls `register_pair_attempt` three times with hash `H1` and once with hash `H2` (`pairing.test.ts`)
- **THEN** the calls return `1`, `2`, `3` and `1`

#### Scenario: Old attempts are purged and not counted
- **GIVEN** a `pair_attempts` row for `H1` with `at` 11 minutes ago and one for `H2` with `at` 11 minutes ago
- **WHEN** the service role calls `register_pair_attempt(H1)` (`pairing.test.ts`)
- **THEN** it returns `1` and no row older than 10 minutes remains for any hash

#### Scenario: Purge runs without new attempts
- **GIVEN** `pair_attempts` rows with `at` 11 minutes ago and 5 minutes ago
- **WHEN** the service role calls `purge_pair_attempts()` and no `register_pair_attempt` is made (`pairing.test.ts`)
- **THEN** the 11-minute-old row is gone and the 5-minute-old row remains
- **AND** parent A and `anon` calling `purge_pair_attempts()` fail with a permission error

#### Scenario: Daily purge job is scheduled
- **GIVEN** the migration SQL text `supabase/migrations/*_device_pairing.sql`
- **WHEN** a test reads it (`pairing.test.ts`)
- **THEN** it contains a `cron.schedule('purge-pair-attempts', ..., 'select public.purge_pair_attempts()')` call with a daily schedule, guarded by a check that the `pg_cron` extension exists

#### Scenario: Raw IPs and outsiders rejected
- **GIVEN** a service-role connection, a parent A connection and an `anon` connection
- **WHEN** the service role inserts a `pair_attempts` row with `ip_hash` `203.0.113.5`, and parent A and `anon` select from `pair_attempts` and call `register_pair_attempt` (`pairing.test.ts`)
- **THEN** the insert fails with a check violation, the selects return no rows or fail, and the calls fail with a permission error
