## MODIFIED Requirements

### Requirement: Rules API for devices
`GET /api/device/rules` with a valid `Authorization: Bearer <device token>` SHALL return 200, `Cache-Control: no-store` and a `RulesResponse` for the token's child. `domains` come from `expandBlockRules` over the child's rules and the global plus family `domain_categories` rows (family rows win). `limits` lists the child's daily category limits as `{ category, minutesPerDay }` and `timezone` is the family's timezone. The version is read before the rules. A missing, malformed or unknown token gets 401.

#### Scenario: Valid token returns version and domains
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store where the token's hash belongs to a child with `rules_version` `3` and rules `domain youtube.com` and `category games`
- **WHEN** `handleRules({ authorization: "Bearer <token>", store })` is called
- **THEN** the store receives `hashDeviceToken(token)`, never the raw token
- **AND** the status is 200, `rulesVersion` is `3`, `domains` contains `youtube.com` and `roblox.com`, `truncated` is `false`
- **AND** the body parses with `RulesResponse` and the headers include `Cache-Control: no-store`

#### Scenario: Family override applies, global row is used
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** the child blocks `games`, a global `domain_categories` row `kidgame.com games`, and a family row `roblox.com education`
- **WHEN** the rules are requested
- **THEN** `domains` contains `kidgame.com` and does not contain `roblox.com`

#### Scenario: Bad token
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **WHEN** `handleRules` is called with `null`, `"Basic abc"` and a bearer token that matches no device
- **THEN** each returns status 401 with body `{ error: "unauthorized" }` and no rules query is made

#### Scenario: Version read before rules
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **WHEN** a valid request is handled
- **THEN** the fake store records `findChild` before `listRules`, `listCategoryOverrides` and `listLimits`

#### Scenario: Only the token's child
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **WHEN** a valid request is handled
- **THEN** `listRules` and `listLimits` are called with the device's `childId` and `listCategoryOverrides` with the child's `familyId`

#### Scenario: Limits and timezone are returned
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store where the child has limits `games 60` and `entertainment 90` and the family timezone is `Asia/Ho_Chi_Minh`
- **WHEN** a valid request is handled
- **THEN** the body `limits` equals `[{ category: "games", minutesPerDay: 60 }, { category: "entertainment", minutesPerDay: 90 }]` and `timezone` is `"Asia/Ho_Chi_Minh"`

#### Scenario: No limits
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store where the child has no limits
- **WHEN** a valid request is handled
- **THEN** the status is 200 and `limits` is `[]`

### Requirement: Rules API fails closed and is capped
`GET /api/device/rules` SHALL return `500 { error: "server_error" }` without `rulesVersion`, `domains` or `limits` when any store call fails, and SHALL return at most `MAX_RULE_DOMAINS` (5000) domains, keeping explicit domain rules first and setting `truncated` to `true` when anything was cut.

#### Scenario: Store failure fails closed
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** the fake store throws in `findChild`, then `listRules`, then `listCategoryOverrides`, then `listLimits` (one run each)
- **WHEN** a valid request is handled
- **THEN** each run returns status 500 with body `{ error: "server_error" }`, no domains, no limits and no rulesVersion

#### Scenario: Domain list is capped
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** 5001 expanded domains in total, of which 10 are explicit `domain` rules
- **WHEN** the rules are requested
- **THEN** `domains` has exactly 5000 entries, includes all 10 explicit domains, and `truncated` is `true`
- **AND** with 5000 or fewer domains, `truncated` is `false`

#### Scenario: Contract limits
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `RulesResponse` parses a body with 5001 domains and one with 5000 domains and `truncated: false`
- **THEN** the first fails and the second parses
- **AND** `MAX_RULE_DOMAINS` is `5000`
