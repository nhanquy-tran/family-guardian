## MODIFIED Requirements

### Requirement: Rules are replaced atomically
`applyRules` SHALL call `updateDynamicRules` once, removing every existing dynamic rule id except the allowed-hours rule id 2000000, which only `reconcileHours` adds or removes, and adding the built rules. `syncRules` SHALL store `rulesAllowedHours` with the other rule inputs only after a successful update and then call `reconcileHours`; a failed sync SHALL keep the stored hours and rules.

#### Scenario: Replace existing rules
- **GIVEN** existing dynamic rule ids `[1, 2, 3]`
- **WHEN** `applyRules` runs with domains `["a.com"]` (`rules.test.ts`)
- **THEN** `updateDynamicRules` was called once with `removeRuleIds: [1, 2, 3]` and one added rule for `a.com`

#### Scenario: Empty rule list clears blocking
- **GIVEN** existing ids `[1]`
- **WHEN** `applyRules` runs with `[]` (`rules.test.ts`)
- **THEN** `updateDynamicRules` was called with `removeRuleIds: [1]` and `addRules: []`

#### Scenario: Sync keeps and updates the hours
- **GIVEN** time `22:00Z`, an answer with `allowedHours` `07:00`-`21:00`, `domains: ["a.com"]`, timezone `UTC`, and existing dynamic rule ids `[1, 2000000]` (`rules.test.ts`)
- **WHEN** `syncRules` runs, and in another run the answer has `allowedHours: null`, and in a third `updateDynamicRules` rejects
- **THEN** in the first one `updateDynamicRules` call removes `[1]` only and adds the `a.com` rule, id 2000000 is still present and storage holds `rulesAllowedHours` `{ start: "07:00", end: "21:00" }`
- **AND** in the second `rulesAllowedHours` is removed and `reconcileHours` removes id 2000000; in the third storage and rules are unchanged and the result is `failed`

### Requirement: Re-pairing resets rule state
A successful `pairWithCode` SHALL remove `rulesVersion`, `blockedQueue`, `rulesLimits`, `rulesTimezone`, `rulesOverrides`, `limitUsage`, `limitBlocked` and `rulesAllowedHours`; a failed one SHALL change nothing. `pairWithCode` SHALL NOT touch alarms or the hours rule: the next `reconcileHours`, finding no stored hours, removes id 2000000.

#### Scenario: Successful re-pair
- **GIVEN** stored `rulesVersion` 4, one queued attempt, stored limit state, `rulesAllowedHours` and the hours rule present
- **WHEN** pairing succeeds (`pairing.test.ts`), then `onAlarm` runs (`controller.test.ts`)
- **THEN** all eight keys are removed, so the next alarm fetches rules, and id 2000000 is absent after that alarm

#### Scenario: Failed pair
- **GIVEN** the same state
- **WHEN** pairing fails with `invalid_code` (`pairing.test.ts`)
- **THEN** all keys and the hours rule are unchanged
