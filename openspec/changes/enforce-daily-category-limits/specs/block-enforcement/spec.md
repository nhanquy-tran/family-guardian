## MODIFIED Requirements

### Requirement: Blocked attempts are recorded as domain and time only
The controller SHALL record `{ at, domain }` when the blocked page reports a domain that is in stored `rulesDomains` or in the keys of stored `limitBlocked`, only while a token exists. `at` SHALL be the ISO time of the report. The queue SHALL keep entries not older than 7 days and at most the newest 1000.

#### Scenario: Known domain recorded
- **GIVEN** a token and `rulesDomains` `["tiktok.com"]`
- **WHEN** `recordBlocked("tiktok.com", now)` runs (`controller.test.ts`)
- **THEN** `blockedQueue` is `[{ at: "2026-11-17T10:05:30.000Z", domain: "tiktok.com" }]`

#### Scenario: Limit-blocked domain recorded
- **GIVEN** a token, `rulesDomains` `[]` and `limitBlocked` `{ "roblox.com": "games" }`
- **WHEN** `recordBlocked("roblox.com", now)` runs (`controller.test.ts`)
- **THEN** `blockedQueue` is `[{ at: "2026-11-17T10:05:30.000Z", domain: "roblox.com" }]`

#### Scenario: Unknown domain ignored
- **GIVEN** `rulesDomains` `["tiktok.com"]`
- **WHEN** `recordBlocked("evil.com", now)` or `recordBlocked("https://tiktok.com/x", now)` runs (`controller.test.ts`)
- **THEN** `blockedQueue` is unchanged

#### Scenario: Unpaired device records nothing
- **GIVEN** no token
- **WHEN** `recordBlocked("tiktok.com", now)` runs (`controller.test.ts`)
- **THEN** nothing is stored

#### Scenario: Queue limits
- **GIVEN** 1000 stored attempts, the oldest one more than 7 days old
- **WHEN** `addBlocked` adds one more (`blocked.test.ts`)
- **THEN** the old one is dropped, 1000 remain, and the new one is the last

#### Scenario: Over the cap
- **GIVEN** 1000 recent stored attempts
- **WHEN** `addBlocked` adds one more (`blocked.test.ts`)
- **THEN** the oldest attempt is dropped, 1000 remain, and the new one is the last

#### Scenario: Corrupt stored queue
- **GIVEN** stored values `undefined`, `"x"`, `[null, {"domain":"a.com"}, <valid attempt>]`
- **WHEN** `parseBlockedQueue` runs (`blocked.test.ts`)
- **THEN** it returns `[]`, `[]`, `[<valid attempt>]`

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
