# domain-categories Specification

## Purpose
Gives the web app and the extension one shared way to map a domain to a fixed category, so the dashboard, category blocking and focus score agree.

All scenarios are unit tests in `packages/shared/src/categories.test.ts`.

## Requirements

### Requirement: Fixed category list
The shared package SHALL export the category list `education`, `entertainment`, `social`, `games`, `news`, `shopping`, `communication`, `productivity`, `other`, in that order, and a `Category` type limited to those values.

#### Scenario: Exported list matches the agreed categories
- **GIVEN** the shared package
- **WHEN** a test reads the exported category list
- **THEN** it equals `["education", "entertainment", "social", "games", "news", "shopping", "communication", "productivity", "other"]`

### Requirement: Seed domain map
The shared package SHALL export a seed map of 140 to 170 domains to categories, covering global and Vietnamese sites. Every key SHALL be a lowercase hostname without a `www.` prefix, scheme, port or path, and every value SHALL be one of the categories.

#### Scenario: Seed size is about 150
- **WHEN** a test counts the seed map entries
- **THEN** the count is at least 140 and at most 170

#### Scenario: Seed keys and values are well formed
- **WHEN** a test checks every seed entry
- **THEN** each key matches `^[a-z0-9-]+(\.[a-z0-9-]+)+$` and does not start with `www.`
- **AND** each value is in the exported category list

#### Scenario: Seed contains the issue's example domains
- **WHEN** a test looks up these keys in the seed map
- **THEN** `youtube.com` is `entertainment`, `tiktok.com` is `social`, `facebook.com` is `social`, `roblox.com` is `games`, `khanacademy.org` is `education`, `vnexpress.net` is `news`, `zalo.me` is `communication`, `docs.google.com` is `productivity` and `classroom.google.com` is `education`

#### Scenario: Seed covers Vietnamese sites
- **WHEN** a test counts seed keys ending in `.vn` plus `vnexpress.net` and `zalo.me`
- **THEN** the count is at least 15

### Requirement: Categorize returns seed category or other
`categorize(domain)` SHALL return the seed category for a known domain and `other` for an unknown, empty or IP-address input. It SHALL never throw.

#### Scenario: Known domain
- **WHEN** `categorize("khanacademy.org")` is called
- **THEN** it returns `education`

#### Scenario: Unknown domain
- **WHEN** `categorize("unknown-example-site.com")` is called
- **THEN** it returns `other`

#### Scenario: Empty or IP input
- **WHEN** `categorize("")`, `categorize("192.168.1.10")` and `categorize("localhost")` are called
- **THEN** each returns `other`

### Requirement: Input normalization
`categorize` SHALL treat the input case-insensitively and ignore surrounding whitespace and a trailing dot.

#### Scenario: Mixed case and trailing dot
- **WHEN** `categorize("YouTube.COM.")` and `categorize(" youtube.com ")` are called
- **THEN** each returns `entertainment`

### Requirement: Subdomain resolution
`categorize` SHALL look up the full host first, then each parent domain in turn, stopping at the registrable domain. The most specific match wins. Public suffixes such as `com.vn` or `co.uk` SHALL never be looked up on their own.

#### Scenario: www prefix falls back to the registrable domain
- **WHEN** `categorize("www.youtube.com")` and `categorize("m.youtube.com")` are called
- **THEN** each returns `entertainment`

#### Scenario: Explicitly listed subdomain keeps its own category
- **GIVEN** the seed lists `docs.google.com` as `productivity` and `classroom.google.com` as `education`
- **WHEN** `categorize("docs.google.com")` and `categorize("classroom.google.com")` are called
- **THEN** they return `productivity` and `education`

#### Scenario: Deeper subdomain of a listed subdomain
- **WHEN** `categorize("a.b.docs.google.com")` is called
- **THEN** it returns `productivity`

#### Scenario: Multi-part public suffix
- **GIVEN** the seed lists `dantri.com.vn` as `news`
- **WHEN** `categorize("www.dantri.com.vn")` is called
- **THEN** it returns `news`
- **AND** `categorize("unknown.com.vn")` returns `other`

### Requirement: Overrides take precedence
`categorize(domain, overrides)` SHALL accept an optional map of lowercase domain to category. If any domain on the lookup path (full host up to registrable domain) is in the overrides, the most specific override SHALL be returned, even when the seed has a more specific entry. Otherwise the seed rules apply.

#### Scenario: Override replaces seed category
- **WHEN** `categorize("youtube.com", { "youtube.com": "education" })` is called
- **THEN** it returns `education`

#### Scenario: Override applies to subdomains
- **WHEN** `categorize("www.youtube.com", { "youtube.com": "education" })` is called
- **THEN** it returns `education`

#### Scenario: Override for unknown domain
- **WHEN** `categorize("myschool.edu.vn", { "myschool.edu.vn": "education" })` is called
- **THEN** it returns `education`

#### Scenario: Override on parent beats more specific seed entry
- **WHEN** `categorize("docs.google.com", { "google.com": "other" })` is called
- **THEN** it returns `other`

#### Scenario: Most specific override wins
- **WHEN** `categorize("docs.google.com", { "google.com": "other", "docs.google.com": "education" })` is called
- **THEN** it returns `education`

#### Scenario: Empty or missing overrides use the seed
- **WHEN** `categorize("facebook.com", {})` and `categorize("facebook.com")` are called
- **THEN** each returns `social`

### Requirement: Public API from the shared package
The category list, `Category` type, seed map and `categorize` SHALL be importable from `@fg/shared`.

#### Scenario: Import from the package entry
- **WHEN** a test imports `categorize` and the category list from `packages/shared/src/index.ts`
- **THEN** both are defined and `categorize("roblox.com")` returns `games`

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
