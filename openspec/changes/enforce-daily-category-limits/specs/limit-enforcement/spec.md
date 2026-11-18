## ADDED Requirements

### Requirement: Usage is counted per category per family-timezone day
`addUsage` SHALL add the seconds of usage entries to the stored per-category seconds of the current day, categorizing each domain with `categorize(domain, overrides)`, and SHALL ignore entries that fall on another day. `dayKey(ms, timezone)` SHALL return the `YYYY-MM-DD` date in that timezone, using `UTC` for a missing or invalid timezone. A stored day different from today SHALL reset the usage.

#### Scenario: Seconds are summed by category with overrides and day
File: `apps/extension/lib/limits.test.ts`
- **GIVEN** timezone `Asia/Ho_Chi_Minh`, overrides `{ "youtube.com": "education" }`, entries `roblox.com 40s`, `roblox.com 20s`, `youtube.com 30s` today and `roblox.com 50s` at `2026-11-17T16:59:00Z` while today is `2026-11-18`
- **WHEN** `addUsage` runs
- **THEN** the seconds are `games 60` and `education 30`
- **AND** `dayKey` returns `2026-11-17` for `2026-11-17T16:59:59Z` and `2026-11-18` for `2026-11-17T17:00:00Z`, and the `UTC` date for timezone `Not/AZone`
- **AND** with `America/New_York`, `2026-11-02T04:59:59Z` is `2026-11-01` and `2026-11-02T05:00:00Z` is `2026-11-02`
- **AND** a stored day of `2026-11-17` with `games 500` yields usage `{}` when today is `2026-11-18`

### Requirement: A category is over its limit at the limit
`overLimitCategories(limits, seconds)` SHALL return the categories whose seconds are at least `minutesPerDay * 60`, and none when there are no limits.

#### Scenario: Limit reached exactly
File: `apps/extension/lib/limits.test.ts`
- **GIVEN** limits `games 5`, `news 10` and seconds `games 300`, `news 599`, `social 9999`
- **WHEN** `overLimitCategories` runs
- **THEN** the result is `["games"]`, and with no limits it is `[]`

### Requirement: A limit blocks the category's domains
`limitBlockDomains` SHALL return, per over-limit category, the seed and override domains whose `categorize(domain, overrides)` is that category plus the domains seen today in that category, excluding domains already in the manual rules, with at most `MAX_RULE_DOMAINS` rules in total with the manual ones. `buildLimitRules` SHALL make `main_frame` redirect rules to `/blocked.html?d=<domain>&c=<category>` with ids after the manual rules.

#### Scenario: Domain set and rules
File: `apps/extension/lib/limits.test.ts`
- **GIVEN** `games` over its limit, overrides `{ "youtube.com": "games", "chess.com": "education" }`, seen today `newgame.example.com` as `games`, and manual domains `["roblox.com"]`
- **WHEN** `limitBlockDomains` and `buildLimitRules` run
- **THEN** the set contains `minecraft.net`, `youtube.com` and `newgame.example.com`, and not `roblox.com` or `chess.com`
- **AND** the rule for `minecraft.net` redirects to `/blocked.html?d=minecraft.net&c=games` and the first limit rule id is the count of valid manual rules (from `buildRules`) plus 1
- **AND** with 4999 manual domains at most one limit rule is produced

### Requirement: The controller enforces limits on every alarm
On each normal alarm the controller SHALL count completed usage, compute the limit-blocked domains from the stored limits, timezone, overrides and usage, and when they differ from the stored `limitBlocked` apply the DNR rules (manual and limit rules together) and store `limitBlocked`. A missing stored `limitBlocked` SHALL count as `{}`. If the DNR update fails it SHALL store nothing and retry at the next alarm.

#### Scenario: Limit reached blocks the category
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** stored limits `games 5`, timezone `UTC`, and 300 seconds of `roblox.com` activity completed
- **WHEN** `onAlarm` runs
- **THEN** the DNR rules include a redirect for `roblox.com` with `c=games` and none for `youtube.com`, and `limitBlocked` has `roblox.com: "games"`

#### Scenario: Reset at midnight in the family timezone
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** fake timers, timezone `Asia/Ho_Chi_Minh`, and `games` blocked at `2026-11-17T16:58:00Z`
- **WHEN** `onAlarm` runs at `16:59:30Z` and then at `17:00:30Z`
- **THEN** the first run keeps the games rules and the second removes them and resets the stored usage to the new day

#### Scenario: Works offline
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** stored limits and a heartbeat that fails with a network error
- **WHEN** usage reaches the limit and `onAlarm` runs
- **THEN** the category rules are applied

#### Scenario: Survives a restart
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** a controller that counted 290 of 300 seconds of `games`, replaced by a new controller on the same store
- **WHEN** 10 more seconds complete and `onAlarm` runs
- **THEN** `games` is blocked

#### Scenario: DNR failure retries
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** the limit is reached and `updateDynamicRules` rejects once
- **WHEN** `onAlarm` runs twice
- **THEN** after the first run `limitBlocked` is not stored, and after the second the rules are applied and stored

### Requirement: A rules sync updates limits and keeps the last ones on failure
`syncRules` SHALL store `rulesLimits`, `rulesTimezone` and `rulesOverrides` together with the rules, and apply limit rules for the already over-limit categories in the same DNR update, and SHALL store `limitBlocked` from that same update, so a manual-rule sync never lifts limit blocks. A failed sync SHALL change none of them. A removed limit, or one raised above today's usage, SHALL unblock the category after the next successful sync.

#### Scenario: Sync stores inputs and unblocks
File: `apps/extension/lib/rules.test.ts`
- **GIVEN** `games` blocked with limit 1 minute and usage 120 seconds, and rules answering `limits: [{ category: "games", minutesPerDay: 5 }]`, then `limits: []`
- **WHEN** `syncRules` runs with each answer
- **THEN** after the first the games rules are gone and `rulesLimits` holds the new limit, and after the second `rulesLimits` is `[]`

#### Scenario: Failed sync keeps limits
File: `apps/extension/lib/rules.test.ts`
- **GIVEN** stored limits `games 5` and the rules request fails with 500, a network error, or a body with `categoryOverrides: "x"`
- **WHEN** `syncRules` runs
- **THEN** `rulesLimits`, `rulesTimezone` and `rulesOverrides` are unchanged and no DNR update happens

#### Scenario: Manual-rule sync keeps limit blocks
File: `apps/extension/lib/rules.test.ts`
- **GIVEN** `games` over its limit with its `c=games` rules applied
- **WHEN** `syncRules` runs with a sync answering `domains: ["tiktok.com"]`
- **THEN** the DNR rules keep the `c=games` rules and add `tiktok.com`, and `limitBlocked` is stored from that update

### Requirement: Limit-blocked attempts are recorded
The controller SHALL record `{ at, domain }` when the blocked page reports a domain that is a key of stored `limitBlocked`, only while a token exists, like attempts on manual rules.

#### Scenario: Limit-blocked domain recorded
File: `apps/extension/lib/controller.test.ts`
- **GIVEN** a token, `rulesDomains` `[]` and `limitBlocked` `{ "roblox.com": "games" }`
- **WHEN** `recordBlocked("roblox.com", now)` runs
- **THEN** `blockedQueue` is `[{ at: "2026-11-17T10:05:30.000Z", domain: "roblox.com" }]`

### Requirement: The block page names the category
`describeBlock(search)` SHALL return the text `Daily limit for <category> reached` when `c` is one of the 9 categories, and the generic blocked text otherwise. It SHALL read only `d` and `c`.

#### Scenario: Limit and generic text
File: `apps/extension/lib/blocked.test.ts`
- **WHEN** `describeBlock` runs with `?d=roblox.com&c=games`, `?d=roblox.com&c=music`, and `?d=roblox.com`
- **THEN** the first text contains `Daily limit for games reached` and the other two contain the generic text and no category
- **AND** none of the texts contains a URL or path
