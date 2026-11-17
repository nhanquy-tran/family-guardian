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
