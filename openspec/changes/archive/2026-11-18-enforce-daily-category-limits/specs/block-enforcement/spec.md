## MODIFIED Requirements

### Requirement: Re-pairing resets rule state
A successful `pairWithCode` SHALL remove `rulesVersion`, `blockedQueue`, `rulesLimits`, `rulesTimezone`, `rulesOverrides`, `limitUsage` and `limitBlocked`; a failed one SHALL change nothing.

#### Scenario: Successful re-pair
- **GIVEN** stored `rulesVersion` 4, one queued attempt and stored limit state
- **WHEN** pairing succeeds (`pairing.test.ts`)
- **THEN** all seven keys are removed, so the next alarm fetches rules

#### Scenario: Failed pair
- **GIVEN** the same state
- **WHEN** pairing fails with `invalid_code` (`pairing.test.ts`)
- **THEN** all keys are unchanged
