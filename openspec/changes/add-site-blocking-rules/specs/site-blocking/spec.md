# Spec Delta

## Purpose

Parents block domains or categories per child; devices fetch the expanded domain list with a version number; blocked attempts are stored and summarized on the child's overview.

Test files (Vitest, run by `npm run check`):
- `supabase/tests/site-blocking.test.ts`: database scenarios, on PGlite with the harness from change `add-database-schema` (`asParent`, `asService`, user helper), after applying every migration.
- `packages/shared/src/block-rules.test.ts` and `packages/shared/src/contracts.test.ts`: expansion and contracts.
- `apps/web/src/lib/block-rules.test.ts`, `apps/web/src/lib/device/rules-endpoint.test.ts`, `apps/web/src/lib/device/block-events.test.ts`, `apps/web/src/lib/blocked-today.test.ts`: modules with a fake Supabase client.
- `apps/web/src/components/block-rules-view.test.ts`, `apps/web/src/components/blocked-today-card.test.ts`: `renderToStaticMarkup` with `createElement`.

Each scenario below names its file.

## ADDED Requirements

### Requirement: Rules version per child
Each child SHALL have an integer `rules_version`, starting at 0, that the database increases on every insert, update or delete of that child's `block_rules`. A parent SHALL NOT be able to change `rules_version` directly.

#### Scenario: New child starts at version 0
File: `supabase/tests/site-blocking.test.ts`
- **WHEN** parent A inserts a child
- **THEN** the child's `rules_version` is `0`

#### Scenario: Adding a rule bumps the version
File: `supabase/tests/site-blocking.test.ts`
- **GIVEN** a child of family A with `rules_version` `v`
- **WHEN** parent A inserts a block rule `domain` `youtube.com` for that child
- **THEN** the child's `rules_version` is greater than `v`

#### Scenario: Removing and updating a rule bump the version
File: `supabase/tests/site-blocking.test.ts`
- **GIVEN** a child of family A with one rule and `rules_version` `v`
- **WHEN** parent A updates the rule's value to `tiktok.com`
- **THEN** `rules_version` is greater than `v`
- **AND WHEN** parent A then deletes the rule
- **THEN** `rules_version` increases again

#### Scenario: Other children are not bumped
File: `supabase/tests/site-blocking.test.ts`
- **GIVEN** two children of family A
- **WHEN** parent A adds a rule for the first child
- **THEN** the second child's `rules_version` is unchanged

#### Scenario: Parent cannot set the version
File: `supabase/tests/site-blocking.test.ts`
- **WHEN** parent A runs `update children set rules_version = 0` on their own child
- **THEN** it fails with a permission error
- **AND** parent A can still update the child's `name`

### Requirement: Block rule values are validated
The database SHALL reject a `domain` rule whose value is not a bare lowercase hostname, and a `category` rule whose value is not one of the 9 categories.

#### Scenario: Invalid rule values rejected
File: `supabase/tests/site-blocking.test.ts`
- **WHEN** the service role inserts a `domain` rule `https://youtube.com/watch`, a `domain` rule `YouTube.com` and a `category` rule `music`
- **THEN** each insert fails with a check violation
- **AND** a `domain` rule `docs.google.com` and a `category` rule `games` succeed

### Requirement: Domain input normalization
`normalizeBlockDomain(input)` SHALL turn what a parent types into a lowercase hostname without scheme, `www.` prefix, port, path, query or fragment, and SHALL return `null` for input that is not a hostname with at least one dot, or is an IPv4 address.

#### Scenario: URLs and casing reduce to the host
File: `apps/web/src/lib/block-rules.test.ts`
- **WHEN** `normalizeBlockDomain` is called with `" https://www.YouTube.com/watch?v=x "`, `"youtube.com/shorts"`, `"WWW.youtube.com."` and `"youtube.com:443"`
- **THEN** each returns `"youtube.com"`

#### Scenario: Subdomains are kept
File: `apps/web/src/lib/block-rules.test.ts`
- **WHEN** `normalizeBlockDomain("docs.google.com")` is called
- **THEN** it returns `"docs.google.com"`

#### Scenario: Invalid input
File: `apps/web/src/lib/block-rules.test.ts`
- **WHEN** `normalizeBlockDomain` is called with `""`, `"localhost"`, `"192.168.1.10"`, `"not a domain"` and `"ftp://"`
- **THEN** each returns `null`

### Requirement: Parents manage block rules per child
A parent SHALL be able to list a child's rules, block a domain, block a category and remove a rule. Invalid input SHALL be rejected before any write, and a duplicate rule or a rule of another family SHALL return an error code instead of throwing.

#### Scenario: Add a domain rule
File: `apps/web/src/lib/block-rules.test.ts`
- **WHEN** `addDomainRule(client, childId, "https://www.tiktok.com/@x")` is called
- **THEN** the fake client receives one insert into `block_rules` with `{ child_id: childId, kind: "domain", value: "tiktok.com" }`
- **AND** the result is `{ ok: true }`

#### Scenario: Add a category rule
File: `apps/web/src/lib/block-rules.test.ts`
- **WHEN** `addCategoryRule(client, childId, "games")` is called
- **THEN** one insert with `{ child_id: childId, kind: "category", value: "games" }` is made and the result is `{ ok: true }`

#### Scenario: Invalid input is not written
File: `apps/web/src/lib/block-rules.test.ts`
- **WHEN** `addDomainRule(client, childId, "localhost")` and `addCategoryRule(client, childId, "music")` are called
- **THEN** the results are `{ ok: false, error: "invalid_domain" }` and `{ ok: false, error: "invalid_category" }`
- **AND** the fake client receives no insert

#### Scenario: Duplicate rule
File: `apps/web/src/lib/block-rules.test.ts`
- **GIVEN** the fake client returns a Postgres error with code `23505` on insert
- **WHEN** `addDomainRule(client, childId, "youtube.com")` is called
- **THEN** the result is `{ ok: false, error: "duplicate" }`

#### Scenario: Remove a rule
File: `apps/web/src/lib/block-rules.test.ts`
- **GIVEN** the fake client's delete returns one row
- **WHEN** `removeBlockRule(client, ruleId)` is called
- **THEN** it deletes from `block_rules` filtered by `id = ruleId` and returns `{ ok: true }`
- **AND GIVEN** the delete returns zero rows, the result is `{ ok: false, error: "not_found" }`

#### Scenario: List rules sorted
File: `apps/web/src/lib/block-rules.test.ts`
- **GIVEN** the fake client returns rules `domain youtube.com`, `category games`, `domain abc.com`
- **WHEN** `listBlockRules(client, childId)` is called
- **THEN** it filters by `child_id = childId` and returns them in the order `category games`, `domain abc.com`, `domain youtube.com`

#### Scenario: Parent cannot touch another family's rules
File: `supabase/tests/site-blocking.test.ts`
- **GIVEN** a rule for family B's child
- **WHEN** parent A selects, deletes and inserts block rules for family B's child
- **THEN** the select returns no rows, the delete affects zero rows, the insert fails with an RLS violation, and family B's `rules_version` is unchanged

### Requirement: Rules page
The page `/dashboard/children/[childId]/rules` SHALL render `BlockRulesView`, which shows the child's name, each rule with its kind and value and a remove button, a form to block a domain, a form to block a category offering all 9 categories, an empty-state message when there are no rules, and a readable message for an error code.

#### Scenario: Rules are listed with remove buttons
File: `apps/web/src/components/block-rules-view.test.ts`
- **WHEN** `BlockRulesView` renders with child name `Minh` and rules `category games` and `domain youtube.com`
- **THEN** the markup contains `Minh`, `games`, `youtube.com` and two remove forms, each carrying its rule id

#### Scenario: Add forms
File: `apps/web/src/components/block-rules-view.test.ts`
- **WHEN** `BlockRulesView` renders
- **THEN** the markup contains a text input for a domain and a `<select>` with exactly the 9 categories as option values

#### Scenario: Empty state and error message
File: `apps/web/src/components/block-rules-view.test.ts`
- **WHEN** `BlockRulesView` renders with no rules and error `invalid_domain`
- **THEN** the markup contains `No sites blocked` and a message containing `domain`
- **AND** rendering with error `duplicate` shows a message containing `already blocked`

### Requirement: Category rules expand to domains
`expandBlockRules(rules, overrides?)` SHALL return the sorted, deduplicated union of all `domain` rule values and every domain in the seed map or the overrides whose `categorize(domain, overrides)` result is a blocked category.

#### Scenario: Domain rules only
File: `packages/shared/src/block-rules.test.ts`
- **WHEN** `expandBlockRules([{ kind: "domain", value: "zeta.com" }, { kind: "domain", value: "alpha.com" }])` is called
- **THEN** it returns `["alpha.com", "zeta.com"]`

#### Scenario: Category expands from the seed
File: `packages/shared/src/block-rules.test.ts`
- **WHEN** `expandBlockRules([{ kind: "category", value: "games" }])` is called
- **THEN** the result contains `roblox.com`
- **AND** every returned domain has `categorize(domain) === "games"`
- **AND** it does not contain `youtube.com`

#### Scenario: Overrides move domains in and out
File: `packages/shared/src/block-rules.test.ts`
- **WHEN** `expandBlockRules([{ kind: "category", value: "games" }], { "roblox.com": "education", "myschoolgame.vn": "games" })` is called
- **THEN** the result contains `myschoolgame.vn` and does not contain `roblox.com`

#### Scenario: No duplicates
File: `packages/shared/src/block-rules.test.ts`
- **WHEN** `expandBlockRules([{ kind: "category", value: "entertainment" }, { kind: "domain", value: "youtube.com" }])` is called
- **THEN** `youtube.com` appears exactly once and the array is sorted ascending

#### Scenario: No rules
File: `packages/shared/src/block-rules.test.ts`
- **WHEN** `expandBlockRules([])` is called
- **THEN** it returns `[]`

### Requirement: Rules API for devices
`GET /api/device/rules` with `Authorization: Bearer <device token>` SHALL return status 200 and a body valid against `RulesResponse` (`{ rulesVersion: integer ≥ 0, domains: string[] }`) for the token's child, with `domains` from `expandBlockRules` using the child's rules and the global plus family `domain_categories` rows (family rows win), and header `Cache-Control: no-store`. It SHALL return 401 for a missing, malformed or unknown token and SHALL read the rules version before the rules.

#### Scenario: Valid token returns version and domains
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake service client where the token's device belongs to a child with `rules_version` `3` and rules `domain youtube.com` and `category games`
- **WHEN** `handleRulesRequest("Bearer <token>", client)` is called
- **THEN** the status is 200, `rulesVersion` is `3`, `domains` contains `youtube.com` and `roblox.com`
- **AND** the body parses with `RulesResponse` and the headers include `Cache-Control: no-store`

#### Scenario: Family override applies, global row is used
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** the child blocks `games`, a global `domain_categories` row `kidgame.com games`, and a family row `roblox.com education`
- **WHEN** the rules are requested
- **THEN** `domains` contains `kidgame.com` and does not contain `roblox.com`

#### Scenario: Bad token
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **WHEN** `handleRulesRequest` is called with `null`, `"Basic abc"` and a bearer token that matches no device
- **THEN** each returns status 401 with body `{ error: "unauthorized" }` and no rules query is made

#### Scenario: Version read before rules
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **WHEN** a valid request is handled
- **THEN** the fake client records the `children` read before the `block_rules` read

#### Scenario: Only the token's child
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **WHEN** a valid request is handled
- **THEN** the `block_rules` query filters by the device's `child_id` and the `domain_categories` query is limited to global rows and the child's family

### Requirement: Blocked attempts are stored from heartbeats
`HeartbeatRequest` SHALL accept an optional `blocked` array (max 1000) of `{ at: ISO datetime, domain }` and nothing else per attempt. The heartbeat route SHALL store valid attempts in `block_events` for the device, dropping attempts older than 7 days, more than 5 minutes in the future, or with an invalid domain, and SHALL not store a resent attempt twice.

#### Scenario: Contract accepts with and without blocked
File: `packages/shared/src/contracts.test.ts`
- **WHEN** a valid heartbeat without `blocked`, and one with `blocked: [{ at: "2026-11-17T10:00:00Z", domain: "tiktok.com" }]` are parsed
- **THEN** both parse
- **AND** an attempt with an extra `url` field is stripped from the parsed output, and 1001 attempts fail to parse

#### Scenario: Valid attempts are upserted
File: `apps/web/src/lib/device/block-events.test.ts`
- **WHEN** `recordBlockedAttempts(client, deviceId, [{ at: now - 1 min, domain: "tiktok.com" }], now)` is called
- **THEN** the fake client receives one upsert into `block_events` with `[{ device_id: deviceId, at, domain: "tiktok.com" }]`, `onConflict` `device_id,at,domain` and `ignoreDuplicates: true`

#### Scenario: Out-of-window and invalid attempts are dropped
File: `apps/web/src/lib/device/block-events.test.ts`
- **WHEN** attempts at `now - 8 days`, `now + 10 min`, and with domain `tiktok.com/@x` are recorded
- **THEN** no query is made

#### Scenario: Resent attempt stored once
File: `supabase/tests/site-blocking.test.ts`
- **WHEN** the service role inserts the same `(device_id, at, domain)` into `block_events` twice with `on conflict do nothing`
- **THEN** exactly one row exists

### Requirement: Blocked today on the child overview
The child overview SHALL show a "Blocked today" card with the number of blocked attempts across the child's devices within today's range and the top 5 blocked domains by count (ties by domain ascending), or `No blocked attempts today` when there are none.

#### Scenario: Summary counts and ranks
File: `apps/web/src/lib/blocked-today.test.ts`
- **WHEN** `summarizeBlocked(["b.com", "a.com", "b.com", "c.com", "a.com", "b.com", "d.com", "e.com", "f.com"])` is called
- **THEN** `count` is `9` and `top` is `[b.com 3, a.com 2, c.com 1, d.com 1, e.com 1]`

#### Scenario: Query is scoped to the child and today
File: `apps/web/src/lib/blocked-today.test.ts`
- **WHEN** `getBlockedToday(client, childId, { from, to })` is called
- **THEN** the fake client queries `block_events` joined to `devices` with `child_id = childId`, `at >= from` and `at < to`

#### Scenario: Card renders summary
File: `apps/web/src/components/blocked-today-card.test.ts`
- **WHEN** `BlockedTodayCard` renders `{ count: 4, top: [{ domain: "tiktok.com", count: 3 }, { domain: "roblox.com", count: 1 }] }`
- **THEN** the markup contains `Blocked today`, `4`, `tiktok.com`, `3`, `roblox.com`

#### Scenario: Card empty state
File: `apps/web/src/components/blocked-today-card.test.ts`
- **WHEN** `BlockedTodayCard` renders `{ count: 0, top: [] }`
- **THEN** the markup contains `No blocked attempts today`

#### Scenario: Parent sees only own family's events
File: `supabase/tests/site-blocking.test.ts`
- **GIVEN** block events for family A's and family B's devices
- **WHEN** parent A selects `block_events` joined to `devices`
- **THEN** only family A's events are returned
