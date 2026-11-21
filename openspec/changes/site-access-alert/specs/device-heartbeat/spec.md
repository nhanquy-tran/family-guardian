## MODIFIED Requirements

### Requirement: Device status update
Every authenticated request with a valid envelope SHALL update the device with `last_seen_at` set to the server's now, `browser` and `extension_version` from the body, and `site_access` set to the body's `siteAccess` only when the body has one (a body without it leaves `site_access` out of the update, and the column keeps its value, default `true`), and nothing else. `currentDomain` SHALL NOT be stored anywhere. Store failures SHALL respond `500 { "error": "server_error" }`.

#### Scenario: Device updated
- **GIVEN** a valid token
- **WHEN** it sends a valid body with browser `edge`, extensionVersion `0.2.0` and currentDomain `youtube.com`
- **THEN** `updateDevice` is called once with `"dev-1"` and exactly `{ last_seen_at: "2026-11-17T10:05:30.000Z", browser: "edge", extension_version: "0.2.0" }`
- **AND** no store call argument contains the value `youtube.com`

#### Scenario: Site access stored as sent
- **GIVEN** a valid token
- **WHEN** it sends a valid body with `siteAccess` `false`, then one with `siteAccess` `true`, then one without it (`heartbeat.test.ts`)
- **THEN** the `site_access` in the three `updateDevice` patches is `false`, `true`, and absent (the third patch has no `site_access` key)

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

## ADDED Requirements

### Requirement: The heartbeat contract carries an optional site-access flag
`HeartbeatRequest` and `HeartbeatEnvelope` in `@fg/shared` SHALL accept an optional `siteAccess` boolean (ADR 0024). Any other type SHALL be rejected, and the endpoint SHALL then respond `400 { "error": "invalid_request" }` and write nothing. A body without it SHALL stay valid.

#### Scenario: Contract accepts and rejects
File: `packages/shared/src/contracts.test.ts`
- **GIVEN** `HeartbeatRequest` and `HeartbeatEnvelope`
- **WHEN** both schemas parse `{ entries: [], currentDomain: null, browser: "edge", extensionVersion: "0.3.0" }` with `siteAccess` `true`, `false`, absent, and then `"no"`, `0` and `null`
- **THEN** the first three succeed and the last three fail, for both schemas

#### Scenario: Keep-alive value ignored on 401
File: `apps/web/src/lib/device/heartbeat.test.ts`
- **GIVEN** a token that matches no device
- **WHEN** it sends a valid body with `siteAccess` `false`
- **THEN** the response is `401` and `updateDevice` is never called

#### Scenario: Wrong type is a bad request, keep-alive value ignored
File: `apps/web/src/lib/device/heartbeat.test.ts`
- **GIVEN** a valid token, and a token that matches no device
- **WHEN** the first sends a valid body with `siteAccess` `"no"`, and the second a valid body with `siteAccess` `false`
- **THEN** the first gets `400 { error: "invalid_request" }`, the second `401`, and `upsertUsage` and `updateDevice` are never called

### Requirement: Store writes the site-access value
`createHeartbeatStore(client).updateDevice` SHALL pass the whole patch, including `site_access`, to a single `devices` update filtered by the device id, and throw on a client error.

#### Scenario: Patch includes site access
File: `apps/web/src/lib/device/supabase-store.test.ts`
- **GIVEN** a fake client that records calls
- **WHEN** `updateDevice("dev-1", { last_seen_at, browser: "edge", extension_version: "0.3.0", site_access: false })` is called, then with a client that returns an error
- **THEN** the client recorded `from("devices")`, `update` with exactly that patch and a filter `id = "dev-1"`, and the second call throws
