## MODIFIED Requirements

### Requirement: Rules contract carries limits and timezone
`RulesResponse` SHALL accept `limits` (an array of at most 9 `{ category, minutesPerDay }` with a known category and an integer from 5 to 1440, default `[]`), an optional non-empty `timezone` string of at most 64 characters, and `categoryOverrides` (a map of domain string, at most 253 characters, to known category with at most `MAX_RULE_DOMAINS` entries, default `{}`). `limits` SHALL NOT contain the same category twice. A body without the new fields SHALL still parse, and unknown fields SHALL be stripped.

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
- **WHEN** `RulesResponse` parses `categoryOverrides: { "youtube.com": "education" }`, then a map with category `music`, a map with a 254-character key, and a map with 5001 entries
- **THEN** the first parses unchanged and the other three fail to parse

## ADDED Requirements

### Requirement: Rules API returns the merged category overrides
`GET /api/device/rules` SHALL return `categoryOverrides` as the merged global and family `domain_categories` map already built for `expandBlockRules` (family rows win), so devices categorize like the dashboard. When capping at `MAX_RULE_DOMAINS`, family rows SHALL come first. The existing `listCategoryOverrides` SHALL be reused; no new store method is added. This adds the field to the site-blocking "Rules API for devices" response.

#### Scenario: Merged rows, family wins, capped
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store with global rows `youtube.com entertainment`, `kidgame.com games` and family rows `youtube.com education`, `roblox.com games`
- **WHEN** `handleRules` runs
- **THEN** `categoryOverrides` is `{ "youtube.com": "education", "roblox.com": "games", "kidgame.com": "games" }`
- **AND** with 5001 merged rows `categoryOverrides` has 5000 entries and the family rows are among them
