## ADDED Requirements

### Requirement: One category-to-domain expansion
The shared package SHALL export `categoryDomains({ categories, overrides?, extraHosts?, exclude?, limit })` returning `{ domains, truncated }`. `domains` SHALL be the hosts from the seed map, the override keys and `extraHosts` whose `categorize(host, overrides)` is in `categories`, minus `exclude`, deduplicated.

#### Scenario: Seed domains of a category
File: `packages/shared/src/category-domains.test.ts`
- **WHEN** `categoryDomains({ categories: ["games"], limit: 5000 })` is called
- **THEN** `domains` contains `roblox.com`, every entry has `categorize(domain) === "games"`, none is `youtube.com`, and the array is sorted ascending
- **AND** `truncated` is `false`

#### Scenario: Overrides win over the seed
File: `packages/shared/src/category-domains.test.ts`
- **WHEN** it is called with `categories: ["games"]` and overrides `{ "roblox.com": "education", "myschoolgame.vn": "games" }`
- **THEN** `domains` contains `myschoolgame.vn` and not `roblox.com`

#### Scenario: Extra hosts and exclusions
File: `packages/shared/src/category-domains.test.ts`
- **WHEN** it is called with `categories: ["games"]`, overrides `{ "newgame.example.com": "games" }`, `extraHosts: ["newgame.example.com", "docs.google.com"]` and `exclude: ["roblox.com"]`
- **THEN** `domains` contains `newgame.example.com` and `minecraft.net`, and does not contain `docs.google.com` or `roblox.com`

### Requirement: The expansion is validated, ordered and capped
`categoryDomains` SHALL keep only hosts of at most 253 characters matching `^[a-z0-9-]+(\.[a-z0-9-]+)+$`, checked before the cap, sort them ascending and return the first `limit`. `truncated` SHALL be `true` exactly when more than `limit` hosts qualified. The result SHALL NOT depend on the order of the inputs.

#### Scenario: Invalid hosts do not use up room
File: `packages/shared/src/category-domains.test.ts`
- **GIVEN** overrides that put `bad_host`, `UPPER.com` and a 254-character host in `games`, and `limit` equal to the number of valid `games` seed domains
- **WHEN** the function is called
- **THEN** none of the invalid hosts is returned and every valid `games` seed domain is returned
- **AND** `truncated` is `false`

#### Scenario: Cap and truncated flag
File: `packages/shared/src/category-domains.test.ts`
- **GIVEN** 5100 override domains in `games`
- **WHEN** it is called with `limit: 5000`, then with `limit` equal to the exact number of qualifying hosts
- **THEN** the first result has 5000 entries that are the first 5000 of the full sorted list, and `truncated` is `true`
- **AND** the second has all hosts and `truncated` is `false`

#### Scenario: Input order does not change the result
File: `packages/shared/src/category-domains.test.ts`
- **WHEN** it is called twice with the same overrides and extra hosts in different key and array order, above the cap
- **THEN** both calls return identical `domains`

#### Scenario: No categories or zero limit
File: `packages/shared/src/category-domains.test.ts`
- **WHEN** it is called with `categories: []`, then with `limit: 0` and `categories: ["games"]`
- **THEN** the first returns `{ domains: [], truncated: false }` and the second `{ domains: [], truncated: true }`

### Requirement: Public API of the expansion
`categoryDomains` SHALL be importable from `@fg/shared`.

#### Scenario: Import from the package entry
File: `packages/shared/src/category-domains.test.ts`
- **WHEN** the test imports `categoryDomains` from `packages/shared/src/index.ts`
- **THEN** it is defined
