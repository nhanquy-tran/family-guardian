## MODIFIED Requirements

### Requirement: Pair contracts send only browser and OS
`PairRequest` SHALL accept exactly `code` (string, max 32), `browser` (`chrome`, `edge`, `brave`, `firefox`, `other`) and `os` (1..32 chars), and strip any other field. `PairResponse` SHALL be `{ deviceToken: string }`.

#### Scenario: Valid request
- **GIVEN** a request object with an extra `url` field
- **WHEN** `PairRequest.parse({ code: "AB2CD3", browser: "edge", os: "Windows", url: "https://x.com/a" })` runs (`pairing.test.ts`)
- **THEN** it returns `{ code: "AB2CD3", browser: "edge", os: "Windows" }` with no `url` key

#### Scenario: Firefox request
- **WHEN** `PairRequest.parse({ code: "AB2CD3", browser: "firefox", os: "Windows" })` runs (`pairing.test.ts`)
- **THEN** it returns `{ code: "AB2CD3", browser: "firefox", os: "Windows" }`

#### Scenario: Invalid request
- **GIVEN** one request with an unsupported browser and one with an empty `os`
- **WHEN** `PairRequest.safeParse` runs on `{ code: "AB2CD3", browser: "netscape", os: "Windows" }` and on `{ code: "AB2CD3", browser: "edge", os: "" }` (`pairing.test.ts`)
- **THEN** both fail
