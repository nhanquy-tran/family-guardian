## MODIFIED Requirements

### Requirement: Re-pairing resets rule state
A successful `pairWithCode` SHALL, before storing the new token, in this order: remove `rulesVersion` in its own store call; remove every dynamic `declarativeNetRequest` rule (manual blocks, limit blocks and the allowed-hours rule 2000000) with `addRules: []`; then remove `rulesDomains`, `blockedQueue`, `rulesLimits`, `rulesTimezone`, `rulesOverrides`, `limitUsage`, `limitBlocked`, `rulesAllowedHours` and `otherUsage`. `pairWithCode` SHALL NOT touch alarms.

#### Scenario: Successful re-pair
- **GIVEN** a paired device with stored `rulesVersion` 4, `rulesDomains` `["a.example"]`, one queued attempt, limit state, `otherUsage` for today, `rulesAllowedHours`, and dynamic rules for `a.example`, a limit block and id 2000000
- **WHEN** pairing succeeds with a new token (`pairing.test.ts`)
- **THEN** the fake `dnr` holds no rule and the ten keys are absent
- **AND** `rulesVersion` was removed before the rules, and the rules were removed before the token was written

#### Scenario: New child's rules apply after the first sync
- **GIVEN** the state after the re-pair above and a rules response with domains `["b.example"]` for the new child
- **WHEN** `onAlarm` runs (`controller.test.ts`)
- **THEN** the only dynamic rule is the one for `b.example`, and `a.example` has none

#### Scenario: The previous child's other usage does not block the new child
- **GIVEN** the state after the re-pair above, limit `games 5` for the new child, local `games` usage 0 and a rules fetch that fails
- **WHEN** `onAlarm` runs (`controller.test.ts`)
- **THEN** `games` is not blocked

#### Scenario: Stale domains are not evaluated after re-pair
- **GIVEN** the state after the re-pair and a rules fetch that fails
- **WHEN** `onAlarm` runs (`controller.test.ts`)
- **THEN** no dynamic rule exists for `a.example` and no limit rule is built from the old domains
