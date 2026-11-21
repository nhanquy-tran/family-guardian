## MODIFIED Requirements

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
