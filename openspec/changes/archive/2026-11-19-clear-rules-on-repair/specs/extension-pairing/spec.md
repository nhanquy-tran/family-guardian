## MODIFIED Requirements

### Requirement: Successful pairing stores the token and starts fresh
On `200` with a body that passes `PairResponse`, `pairWithCode` SHALL remove `queue`, `trackerState` and `authState` and the previous device's rules and rule state as defined in the block-enforcement requirement "Re-pairing resets rule state", then store `browser` and `deviceToken`, replacing any earlier token, and return `{ ok: true }`. The token SHALL be stored only under `deviceToken`.

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
