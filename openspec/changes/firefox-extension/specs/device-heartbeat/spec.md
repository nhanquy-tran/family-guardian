## ADDED Requirements

### Requirement: Heartbeat contracts accept the Firefox browser value
`HeartbeatRequest` and `HeartbeatEnvelope` SHALL accept `firefox` as `browser`, and SHALL still reject any value outside `chrome`, `edge`, `brave`, `firefox`, `other`.

#### Scenario: Firefox heartbeat
- **WHEN** `HeartbeatRequest.safeParse` and `HeartbeatEnvelope.safeParse` run on `{ entries: [], currentDomain: null, browser: "firefox", extensionVersion: "0.3.0" }` and on the same body with `browser: "netscape"` (`contracts.test.ts`)
- **THEN** the first two succeed and the last two fail
