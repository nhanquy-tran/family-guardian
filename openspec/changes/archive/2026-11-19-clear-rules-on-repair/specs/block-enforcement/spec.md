## MODIFIED Requirements

### Requirement: Re-pairing resets rule state
A successful `pairWithCode` SHALL, before storing the new token, in this order: remove `rulesVersion` in its own store call; remove every dynamic `declarativeNetRequest` rule (manual blocks, limit blocks and the allowed-hours rule 2000000) with `addRules: []`; then remove `rulesDomains`, `blockedQueue`, `rulesLimits`, `rulesTimezone`, `rulesOverrides`, `limitUsage`, `limitBlocked` and `rulesAllowedHours`. `pairWithCode` SHALL NOT touch alarms.

#### Scenario: Successful re-pair
- **GIVEN** a paired device with stored `rulesVersion` 4, `rulesDomains` `["a.example"]`, one queued attempt, limit state, `rulesAllowedHours`, and dynamic rules for `a.example`, a limit block and id 2000000
- **WHEN** pairing succeeds with a new token (`pairing.test.ts`)
- **THEN** the fake `dnr` holds no rule and the nine keys are absent
- **AND** `rulesVersion` was removed before the rules, and the rules were removed before the token was written

#### Scenario: New child's rules apply after the first sync
- **GIVEN** the state after the re-pair above and a rules response with domains `["b.example"]` for the new child
- **WHEN** `onAlarm` runs (`controller.test.ts`)
- **THEN** the only dynamic rule is the one for `b.example`, and `a.example` has none

#### Scenario: Stale domains are not evaluated after re-pair
- **GIVEN** the state after the re-pair and a rules fetch that fails
- **WHEN** `onAlarm` runs (`controller.test.ts`)
- **THEN** no dynamic rule exists for `a.example` and no limit rule is built from the old domains

## ADDED Requirements

### Requirement: A failed re-pair never leaves the device unblocked
A pairing that fails before the server accepts the code SHALL change nothing. If a step after the server accepted fails, `pairWithCode` SHALL keep the old token, return `failed`, and leave `rulesVersion` absent so the next sync rebuilds the rules.

#### Scenario: Removing the rules fails
- **GIVEN** the same state as the first scenario and a `dnr` whose `getDynamicRules` rejects, or whose `updateDynamicRules` rejects
- **WHEN** `pairWithCode` is called with a valid code (`pairing.test.ts`)
- **THEN** it returns `{ ok: false, reason: "failed" }` without throwing
- **AND** the old token and all stored keys other than `rulesVersion` are unchanged, `rulesVersion` may be absent, and the old rules are unchanged

#### Scenario: Store write fails after the rules were cleared
- **GIVEN** a device paired with `rulesVersion` 4, `rulesDomains` `["a.example"]` and a rule for `a.example`, and a store whose write after the rules clearing rejects
- **WHEN** `pairWithCode` is called with a valid code, then `onAlarm` runs with a heartbeat returning the same `rulesVersion` 4 and a rules response for `["a.example"]` (`controller.test.ts`)
- **THEN** pairing returned `failed`, the old token is still stored, and after the alarm the dynamic rule for `a.example` exists again

#### Scenario: Failed pair
- **GIVEN** the same state
- **WHEN** pairing fails with `invalid_code` (`pairing.test.ts`)
- **THEN** all keys and all dynamic rules are unchanged
