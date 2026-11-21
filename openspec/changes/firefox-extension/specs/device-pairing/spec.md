## MODIFIED Requirements

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
