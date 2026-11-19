# site-blocking Specification

## Purpose
Parents block domains or categories per child; devices fetch a capped, versioned domain list; blocked attempts from heartbeats are stored once. The rules version (`children.rules_version`, bump triggers, parent write protection) already exists from change `add-heartbeat-api` (#10) and is covered by `supabase/tests/heartbeat.test.ts`; it is not specified again here. Extension enforcement is #15; the blocked-today card belongs to #12.

Test files (Vitest, run by `npm run check`):
- `supabase/tests/site-blocking.test.ts`: database scenarios, on PGlite with the harness from change `add-database-schema` (`asParent`, `asService`, user helper), after applying every migration.
- `packages/shared/src/block-rules.test.ts` and `packages/shared/src/contracts.test.ts`: expansion and contracts.
- `apps/web/src/lib/block-rules.test.ts`, `apps/web/src/lib/device/rules-endpoint.test.ts`, `apps/web/src/lib/device/heartbeat.test.ts`: modules with fake stores/clients.
- `apps/web/src/components/block-rules-view.test.ts`: `renderToStaticMarkup` with `createElement`.

Each scenario below names its file.

## Requirements

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

#### Scenario: Store failure returns an error code
File: `apps/web/src/lib/block-rules.test.ts`
- **GIVEN** the fake client returns a non-`23505` error on insert, on delete and on select
- **WHEN** `addDomainRule`, `removeBlockRule` and `listBlockRules` are called
- **THEN** the first two return `{ ok: false, error: "failed" }` and `listBlockRules` returns a failed result instead of an empty list
- **AND** none of them throws

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

#### Scenario: Listing failure is not shown as empty
File: `apps/web/src/components/block-rules-view.test.ts`
- **WHEN** `BlockRulesView` renders with error `failed`
- **THEN** the markup contains a message that rules could not be loaded or saved

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
`GET /api/device/rules` with a valid device bearer token SHALL return 200, `Cache-Control: no-store` and a `RulesResponse` for the token's child. `domains` come from `expandBlockRules` over the child's rules and the global plus family `domain_categories` rows (family rows win). `limits` lists the child's daily category limits as `{ category, minutesPerDay }` and `timezone` is the family's timezone. The version is read before the rules. A missing, malformed or unknown token gets 401.

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

### Requirement: Blocked attempts are stored from heartbeats
`HeartbeatEnvelope` and `HeartbeatRequest` SHALL accept an optional `blocked` array of `{ at: ISO datetime, domain }` and nothing else per attempt. The heartbeat handler SHALL validate each attempt separately, skip invalid ones, and store valid ones in `block_events` for the device. A request without `blocked` SHALL behave exactly as before.

#### Scenario: Contract accepts with and without blocked
File: `packages/shared/src/contracts.test.ts`
- **WHEN** a valid heartbeat without `blocked`, and one with `blocked: [{ at: "2026-11-17T10:00:00Z", domain: "tiktok.com" }]` are parsed with `HeartbeatRequest` and `HeartbeatEnvelope`
- **THEN** both parse
- **AND** an attempt with an extra `url` field is stripped from the parsed `HeartbeatRequest` output, and 1001 attempts fail to parse
- **AND** `MAX_BLOCKED_ATTEMPTS` is `1000`

#### Scenario: Valid blocked attempt stored
File: `apps/web/src/lib/device/heartbeat.test.ts`
- **GIVEN** a valid token and a body with `blocked: [{ at: now - 1 min, domain: "tiktok.com" }]`
- **WHEN** `handleHeartbeat` runs
- **THEN** the fake store receives one `insertBlocked` call with `[{ device_id, at, domain: "tiktok.com" }]`, after `upsertUsage` and before `updateDevice`
- **AND** the status is 200 with the usual `rulesVersion`

#### Scenario: Invalid attempts skipped, valid ones kept
File: `apps/web/src/lib/device/heartbeat.test.ts`
- **GIVEN** `blocked` contains attempts at `now - 8 days`, at `now + 10 min`, with domain `tiktok.com/@x`, one that is not an object, and one valid attempt
- **WHEN** `handleHeartbeat` runs
- **THEN** `insertBlocked` receives only the valid attempt and the status is 200
- **AND** the `log` callback reports the four invalid attempts in `skipped`
- **AND** when no attempt is valid, `insertBlocked` is not called

#### Scenario: Request without blocked unchanged
File: `apps/web/src/lib/device/heartbeat.test.ts`
- **WHEN** a heartbeat without `blocked` is handled
- **THEN** the response and store calls are the same as before this change and `insertBlocked` is not called

#### Scenario: Blocked insert failure
File: `apps/web/src/lib/device/heartbeat.test.ts`
- **GIVEN** `insertBlocked` throws
- **WHEN** a heartbeat with a valid blocked attempt is handled
- **THEN** the response is `500 { error: "server_error" }`

### Requirement: Blocked attempts are bounded and idempotent
The handler SHALL reject more than `MAX_BLOCKED_ATTEMPTS` (1000) with `413 { error: "too_many_entries" }` and write nothing. An attempt is valid when it parses, `at` is not older than 7 days or more than 5 minutes in the future (same window as usage), and `domain` matches the domain regex. A resent attempt SHALL NOT be stored twice (`on conflict do nothing`).

#### Scenario: Too many blocked attempts
File: `apps/web/src/lib/device/heartbeat.test.ts`
- **WHEN** a valid-envelope request has 1001 `blocked` items
- **THEN** the response is `413 { error: "too_many_entries" }` and the store receives no writes, not even `updateDevice`
- **AND** a request with exactly 1000 is accepted

#### Scenario: Duplicate attempts in one request stored once
File: `apps/web/src/lib/device/heartbeat.test.ts`
- **WHEN** `blocked` contains the same `{ at, domain }` twice
- **THEN** `insertBlocked` receives one row

#### Scenario: Resent attempt not double counted
File: `supabase/tests/site-blocking.test.ts`
- **WHEN** the service role inserts the same `(device_id, at, domain)` into `block_events` twice with `on conflict do nothing`
- **THEN** exactly one row exists
- **AND** the same `(device_id, at)` with another domain, and the same `(at, domain)` for another device, are stored as separate rows

#### Scenario: Parent sees only own family's events
File: `supabase/tests/site-blocking.test.ts`
- **GIVEN** block events for family A's and family B's devices
- **WHEN** parent A selects `block_events` joined to `devices`
- **THEN** only family A's events are returned

### Requirement: The rules response carries the child's other devices' usage
`GET /api/device/rules` SHALL include `otherUsage` `{ day, seconds }` (category seconds only, computed for the token's device as for the heartbeat response) as an extra of the body that is not part of the `RulesResponse` schema. The handler SHALL add it only when it passes `OtherUsage.safeParse`, after `RulesResponse.parse` of the base body. If it cannot be computed or is invalid the endpoint SHALL still answer 200 without it, never 500.

#### Scenario: Rules include other usage
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store whose `otherUsage` returns `{ day: "2026-11-17", seconds: { games: 600 } }`
- **WHEN** a valid request is handled
- **THEN** the body parses with `RulesResponse` and its `otherUsage` equals that value

#### Scenario: Other usage fails
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store whose `otherUsage` throws
- **WHEN** a valid request is handled
- **THEN** the status is 200 and the body has no `otherUsage`

#### Scenario: Invalid value does not cause a 500
File: `apps/web/src/lib/device/rules-endpoint.test.ts`
- **GIVEN** a fake store whose `otherUsage` returns `{ day: "x", seconds: { games: -1 } }`
- **WHEN** a valid request is handled
- **THEN** the status is 200, the rules are returned, and the body has no `otherUsage`

#### Scenario: Contract
File: `packages/shared/src/contracts.test.ts`
- **WHEN** `OtherUsage.safeParse` runs on `{ day: "2026-11-17", seconds: { games: 60 } }`, and on `{ day: "x", seconds: {} }`, an unknown category, a negative or fractional seconds value, or a domain key
- **THEN** the first parses and the rest fail
- **AND** `HeartbeatResponse` and `RulesResponse` still parse their base bodies when `otherUsage` is absent or invalid

### Requirement: The store maps domains to categories
The store method `otherUsage(deviceId)` SHALL map the domains of `device_other_usage` to categories with `categorize` and global and family override rows (family wins), as for the rules (paged with `.range()`; the seeds are in `categorize`, and the 5000 limit of `listCategoryOverrides` SHALL NOT be relied on), and SHALL throw on an RPC error.

#### Scenario: Store maps domains to categories
File: `apps/web/src/lib/device/supabase-store.test.ts`
- **GIVEN** a fake client whose RPC `device_other_usage` returns `roblox.com 300` and `youtube.com 60`, with a family override `roblox.com` as `education` and an override of another family, and `day` `2026-11-17`
- **WHEN** `otherUsage(deviceId)` runs
- **THEN** the result is `{ day: "2026-11-17", seconds: { education: 300, entertainment: 60 } }` (by `categorize`) with no domain keys, a null-domain row adds nothing, global and family override rows (family wins), as for the rules were read, and an RPC error makes it throw
