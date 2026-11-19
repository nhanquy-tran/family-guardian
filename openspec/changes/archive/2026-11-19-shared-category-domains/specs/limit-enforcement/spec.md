## MODIFIED Requirements

### Requirement: A limit blocks the category's domains
`limitBlockDomains` SHALL return, per over-limit category, the domains from `categoryDomains` (seed, override and seen-today domains in that category, cut alphabetically), excluding manual-rule domains, with at most `MAX_RULE_DOMAINS` rules in total with the manual ones. `buildLimitRules` SHALL make `main_frame` redirect rules to `/blocked.html?d=<domain>&c=<category>` with ids after the manual rules.

#### Scenario: Domain set and rules
File: `apps/extension/lib/limits.test.ts`
- **GIVEN** `games` over its limit, overrides `{ "youtube.com": "games", "chess.com": "education" }`, seen today `newgame.example.com` as `games`, and manual domains `["roblox.com"]`
- **WHEN** `limitBlockDomains` and `buildLimitRules` run
- **THEN** the set contains `minecraft.net`, `youtube.com` and `newgame.example.com`, and not `roblox.com` or `chess.com`
- **AND** the rule for `minecraft.net` redirects to `/blocked.html?d=minecraft.net&c=games` and the first limit rule id is the count of valid manual rules (from `buildRules`) plus 1
- **AND** with 4999 manual domains at most one limit rule is produced

#### Scenario: Same list as the server above the cap
File: `apps/extension/lib/limits.test.ts`
- **GIVEN** `games` over its limit, 5100 overrides in `games`, no manual domains and nothing seen today
- **WHEN** `limitBlockDomains` runs
- **THEN** its keys equal `categoryDomains({ categories: ["games"], overrides, limit: 5000 }).domains` (the list the rules endpoint builds for the same input)

#### Scenario: Invalid seen domains do not use up room
File: `apps/extension/lib/limits.test.ts`
- **GIVEN** seen today `bad_host` as `games` and 4999 manual domains
- **WHEN** `limitBlockDomains` runs
- **THEN** the set does not contain `bad_host` and contains exactly one valid `games` domain, the first alphabetically
