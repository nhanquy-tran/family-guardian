## MODIFIED Requirements

### Requirement: Rules API fails closed and is capped
`GET /api/device/rules` SHALL return `500 { error: "server_error" }` without `rulesVersion`, `domains` or `limits` when any store call fails, and SHALL return at most `MAX_RULE_DOMAINS` (5000) domains, keeping explicit domain rules first (sorted) and then the category-expanded domains from `categoryDomains`, computed with the same capped override map the response carries as `categoryOverrides`. It SHALL set `truncated` to `true` when anything was cut.

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

#### Scenario: Category domains are cut alphabetically
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a category rule for `games`, 5100 family overrides in `games` inserted in reverse alphabetical order, and 10 explicit domains
- **WHEN** the rules are requested
- **THEN** `domains` is the 10 sorted explicit domains followed by the first 4990 entries of `categoryDomains` for the same input (alphabetical, without the explicit ones)

#### Scenario: Contract limits
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `RulesResponse` parses a body with 5001 domains and one with 5000 domains and `truncated: false`
- **THEN** the first fails and the second parses
- **AND** `MAX_RULE_DOMAINS` is `5000`
