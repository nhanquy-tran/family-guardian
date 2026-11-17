# Spec Delta

## Purpose

The extension's options page trades a pairing code for a device token and shows whether the extension is connected.

Test files:
- `apps/extension/lib/pairing.test.ts`: `pairWithCode` and `connectionStatus` with an in-memory `KeyValueStore` fake and a recording `post` fake. Base URL `https://fg.example`, browser `edge` (passed in `deps`, detected by the options page), OS `Windows` unless stated.
- `apps/extension/lib/config.test.ts`: `resolveApiBaseUrl`.

## ADDED Requirements

### Requirement: Pair request sends only code, browser and OS
`pairWithCode` SHALL normalise the code with `normalizePairingCode`, and for a valid code send one `POST` to `<baseUrl>/api/device/pair` with header `Content-Type: application/json` and a JSON body with exactly the keys `code`, `browser` and `os`. A code that does not normalise SHALL return `invalid_code` without any request.

#### Scenario: Request shape
- **GIVEN** an empty store and a `post` fake answering `200 { deviceToken: "tok-1" }`
- **WHEN** `pairWithCode(deps, " ab2-cd3 ")` is called (`pairing.test.ts`)
- **THEN** `post` was called once with URL `https://fg.example/api/device/pair`
- **AND** the parsed body equals exactly `{ code: "AB2CD3", browser: "edge", os: "Windows" }`
- **AND** the headers contain no `Authorization`

#### Scenario: Malformed code is not sent
- **GIVEN** a `post` fake
- **WHEN** `pairWithCode(deps, "AB2CD0")` and `pairWithCode(deps, "")` are called (`pairing.test.ts`)
- **THEN** each returns `{ ok: false, reason: "invalid_code" }` and `post` was never called

### Requirement: Successful pairing stores the token and starts fresh
On `200` with a body that passes `PairResponse`, `pairWithCode` SHALL remove `queue`, `trackerState` and `authState`, then store `browser` and `deviceToken`, replacing any earlier token, and return `{ ok: true }`. The token SHALL be stored only under `deviceToken`.

#### Scenario: First pairing
- **GIVEN** an empty store and `post` answering `200 { deviceToken: "tok-1" }`
- **WHEN** `pairWithCode(deps, "AB2CD3")` is called (`pairing.test.ts`)
- **THEN** it returns `{ ok: true }` and the store holds `deviceToken` `"tok-1"` and `browser` `"edge"`
- **AND** `connectionStatus(store)` returns `"connected"`

#### Scenario: Re-pairing replaces the old token and its data
- **GIVEN** a store with `deviceToken` `"old"`, a non-empty `queue` and a `trackerState`
- **WHEN** `pairWithCode` succeeds with `deviceToken` `"tok-2"` (`pairing.test.ts`)
- **THEN** the store holds `deviceToken` `"tok-2"` and no `queue` or `trackerState` key
- **AND** the removal happened before the token was written

#### Scenario: Re-pairing while rejected
- **GIVEN** a store with `deviceToken` `"old"`, `authState` `"rejected"` and a non-empty `queue`
- **WHEN** `pairWithCode` succeeds with `deviceToken` `"tok-2"` (`pairing.test.ts`)
- **THEN** the store holds `deviceToken` `"tok-2"` and no `authState`, `queue` or `trackerState` key
- **AND** `connectionStatus(store)` returns `"connected"`

#### Scenario: Failed pairing while rejected stays rejected
- **GIVEN** a store with `deviceToken` `"old"` and `authState` `"rejected"`, and `post` answering `400 { error: "invalid_code" }`
- **WHEN** `pairWithCode(deps, "ZZZZZZ")` is called (`pairing.test.ts`)
- **THEN** it returns `{ ok: false, reason: "invalid_code" }` and the store still holds `authState` `"rejected"`, `deviceToken` `"old"` and its queue

#### Scenario: Store write fails
- **GIVEN** `post` answering `200 { deviceToken: "tok-1" }` and a store whose `set` rejects
- **WHEN** `pairWithCode(deps, "AB2CD3")` is called (`pairing.test.ts`)
- **THEN** it returns `{ ok: false, reason: "failed" }` and does not throw

### Requirement: Failed pairing changes nothing
For `400 { error: "invalid_code" }` `pairWithCode` SHALL return reason `invalid_code`; for `429` reason `rate_limited`; for any other status, a `200` body that fails `PairResponse`, or a rejected `post`, reason `failed`. In every failure case the stored `deviceToken`, `queue`, `trackerState`, `authState` and `browser` SHALL be unchanged. `PAIR_MESSAGES` SHALL map each reason, plus `misconfigured`, to a message.

#### Scenario: Wrong code keeps an existing connection
- **GIVEN** a store with `deviceToken` `"old"` and a queue of 2 entries, and `post` answering `400 { error: "invalid_code" }`
- **WHEN** `pairWithCode(deps, "ZZZZZZ")` is called (`pairing.test.ts`)
- **THEN** it returns `{ ok: false, reason: "invalid_code" }`
- **AND** the store still holds `deviceToken` `"old"` and the same 2 queued entries

#### Scenario: Rate limited, server error, bad body, network failure
- **GIVEN** a store with `deviceToken` `"old"`
- **WHEN** `post` answers `429 { error: "rate_limited" }`, then `500 { error: "server_error" }`, then `200 { token: "x" }`, then rejects with `TypeError("Failed to fetch")` (`pairing.test.ts`)
- **THEN** the results are reasons `rate_limited`, `failed`, `failed`, `failed`, none throws
- **AND** the store still holds `deviceToken` `"old"`

#### Scenario: Messages
- **GIVEN** `PAIR_MESSAGES`
- **WHEN** a test reads it (`pairing.test.ts`)
- **THEN** it has a non-empty message for `invalid_code`, `rate_limited`, `failed` and `misconfigured`, and none contains a code, token or URL

### Requirement: Connection status
`connectionStatus(store)` SHALL return `"rejected"` when `deviceToken` is a non-empty string and `authState` is `"rejected"`, `"connected"` when `deviceToken` is a non-empty string otherwise, and `"not_connected"` in all other cases, including when reading the store fails. The options page SHALL show "Connected.", "Disconnected. Ask your parent to pair this browser again." or "Not connected." accordingly.

#### Scenario: Status values
- **GIVEN** stores with `deviceToken` `"tok-1"`, with none, with `""`, with `42`, and one whose `get` rejects
- **WHEN** `connectionStatus` is called on each (`pairing.test.ts`)
- **THEN** it returns `"connected"`, then `"not_connected"` four times

#### Scenario: Rejected status
- **GIVEN** stores with `deviceToken` `"tok-1"` and `authState` `"rejected"`, with `deviceToken` `"tok-1"` and `authState` `"x"`, and with `authState` `"rejected"` but no token
- **WHEN** `connectionStatus` is called on each (`pairing.test.ts`)
- **THEN** it returns `"rejected"`, `"connected"` and `"not_connected"`

#### Scenario: Status text
- **GIVEN** the options page status mapping (`pairing.test.ts`)
- **WHEN** a test reads the text for `connected`, `rejected` and `not_connected`
- **THEN** the texts are "Connected.", "Disconnected. Ask your parent to pair this browser again." and "Not connected."

### Requirement: API base URL from build-time env
`resolveApiBaseUrl(raw)` SHALL return the URL without a trailing `/` when it is `https:`, or `http:` on host `localhost` or `127.0.0.1`, and SHALL throw an error whose message contains `WXT_API_BASE_URL` otherwise. The options page and background SHALL read it from `import.meta.env.WXT_API_BASE_URL`; when it throws, the options page shows `PAIR_MESSAGES.misconfigured` and no request is made.

#### Scenario: Accepted URLs
- **GIVEN** `resolveApiBaseUrl`
- **WHEN** it is called with `https://fg.example/`, `https://fg.example` and `http://localhost:3000` (`config.test.ts`)
- **THEN** it returns `https://fg.example`, `https://fg.example` and `http://localhost:3000`

#### Scenario: Rejected URLs
- **GIVEN** `resolveApiBaseUrl`
- **WHEN** it is called with `undefined`, `""`, `not a url`, `http://fg.example` and `ftp://fg.example` (`config.test.ts`)
- **THEN** each throws an error whose message contains `WXT_API_BASE_URL`

#### Scenario: Variable documented without a value
- **GIVEN** `apps/extension/.env.example`
- **WHEN** a test reads it (`config.test.ts`)
- **THEN** it contains the line `WXT_API_BASE_URL=` with an empty value
