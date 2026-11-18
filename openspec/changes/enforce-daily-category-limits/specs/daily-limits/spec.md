## MODIFIED Requirements

### Requirement: Rules contract carries limits and timezone
`RulesResponse` SHALL accept `limits` (an array of at most 9 `{ category, minutesPerDay }` with a known category and an integer from 5 to 1440, default `[]`), an optional non-empty `timezone` string of at most 64 characters, and `categoryOverrides` (a map of domain string to known category with at most `MAX_RULE_DOMAINS` entries, default `{}`). `limits` SHALL NOT contain the same category twice. A body without the new fields SHALL still parse, and unknown fields SHALL be stripped.

#### Scenario: New fields parse and are bounded
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `RulesResponse` parses a body with `limits: [{ category: "games", minutesPerDay: 60 }]` and `timezone: "Asia/Ho_Chi_Minh"`
- **THEN** it parses unchanged
- **AND** a limit with category `music`, with `minutesPerDay` `4`, `1441` or `1.5`, an empty `timezone`, a 65-character `timezone`, and 10 limits each fail to parse

#### Scenario: Duplicate categories rejected
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `RulesResponse` parses `limits` with `games 60` twice
- **THEN** it fails to parse

#### Scenario: Older body still parses
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `RulesResponse` parses `{ rulesVersion: 1, domains: [], truncated: false }`
- **THEN** it parses with `limits` equal to `[]`, `categoryOverrides` equal to `{}` and no `timezone`

#### Scenario: Category overrides are bounded
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `RulesResponse` parses `categoryOverrides: { "youtube.com": "education" }`, then a map with category `music`, and a map with 5001 entries
- **THEN** the first parses unchanged and the other two fail to parse

## ADDED Requirements

### Requirement: Rules API returns the family's category overrides
`GET /api/device/rules` SHALL return `categoryOverrides` with the family's own `domain_categories` rows only (no global rows), at most `MAX_RULE_DOMAINS`. The store SHALL read them in pages with `.range()` and throw on a database error so the endpoint answers 500.

#### Scenario: Family rows only
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store with a global row `youtube.com entertainment` and family rows `youtube.com education`, `roblox.com games`
- **WHEN** `handleRules` runs
- **THEN** `categoryOverrides` is `{ "youtube.com": "education", "roblox.com": "games" }`

#### Scenario: Store reads family rows in pages and fails closed
File: `apps/web/src/lib/device/supabase-store.test.ts`
- **GIVEN** a fake client returning 1000 family rows for the first range and 3 for the second, and in another run an error
- **WHEN** the store's family overrides method runs for `family_id = fam-1`
- **THEN** it returns 1003 rows after two `.range()` calls, and throws in the error run
