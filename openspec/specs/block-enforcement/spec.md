# block-enforcement Specification

## Purpose
The extension keeps the child's block rules in sync with the server, enforces them with `declarativeNetRequest` (also offline), and reports blocked attempts (domain and time only) in the heartbeat.

Test files:
- `apps/extension/lib/rules.test.ts`: `buildRules`, `applyRules`, `syncRules` with a fake `dnr` (records calls, can fail), a `get` fake scripted like `post`, and an in-memory store.
- `apps/extension/lib/blocked.test.ts`: `parseBlockedQueue`, `addBlocked`, `parseBlockedMessage`.
- `apps/extension/lib/sender.test.ts`, `controller.test.ts`, `pairing.test.ts`: extended.
- `apps/extension/lib/manifest.test.ts`: `buildManifest`.

Unless stated: token `tok-1`, base URL `https://fg.example`, now `2026-11-17T10:05:30Z`.

## Requirements

### Requirement: DNR rules block domains and subdomains on main-frame navigation
`buildRules` SHALL produce one redirect rule per valid, unique domain (at most 5000): `main_frame` only, `requestDomains: [domain]`, redirect to `/blocked.html?d=<domain>`, ids `1..n`.

#### Scenario: Rule shape
- **GIVEN** domains `["tiktok.com"]`
- **WHEN** `buildRules` runs (`rules.test.ts`)
- **THEN** the result is `[{ id: 1, priority: 1, action: { type: "redirect", redirect: { extensionPath: "/blocked.html?d=tiktok.com" } }, condition: { requestDomains: ["tiktok.com"], resourceTypes: ["main_frame"] } }]`

#### Scenario: Invalid, duplicate and excess domains
- **GIVEN** domains `["a.com", "a.com", "bad domain", "https://x.com/p", "", "b.com"]`
- **WHEN** `buildRules` runs (`rules.test.ts`)
- **THEN** only `a.com` (id 1) and `b.com` (id 2) are produced
- **AND** given 5001 distinct valid domains, 5000 rules are produced

### Requirement: Rules are replaced atomically
`applyRules` SHALL call `updateDynamicRules` once, removing every existing dynamic rule id except the allowed-hours rule id 2000000, which only `reconcileHours` adds or removes, and adding the built rules. `syncRules` SHALL store `rulesAllowedHours` with the other rule inputs only after a successful update and then call `reconcileHours`; a failed sync SHALL keep the stored hours and rules.

#### Scenario: Replace existing rules
- **GIVEN** existing dynamic rule ids `[1, 2, 3]`
- **WHEN** `applyRules` runs with domains `["a.com"]` (`rules.test.ts`)
- **THEN** `updateDynamicRules` was called once with `removeRuleIds: [1, 2, 3]` and one added rule for `a.com`

#### Scenario: Empty rule list clears blocking
- **GIVEN** existing ids `[1]`
- **WHEN** `applyRules` runs with `[]` (`rules.test.ts`)
- **THEN** `updateDynamicRules` was called with `removeRuleIds: [1]` and `addRules: []`

#### Scenario: Sync keeps and updates the hours
- **GIVEN** time `22:00Z`, an answer with `allowedHours` `07:00`-`21:00`, `domains: ["a.com"]`, timezone `UTC`, and existing dynamic rule ids `[1, 2000000]` (`rules.test.ts`)
- **WHEN** `syncRules` runs, and in another run the answer has `allowedHours: null`, and in a third `updateDynamicRules` rejects
- **THEN** in the first one `updateDynamicRules` call removes `[1]` only and adds the `a.com` rule, id 2000000 is still present and storage holds `rulesAllowedHours` `{ start: "07:00", end: "21:00" }`
- **AND** in the second `rulesAllowedHours` is removed and `reconcileHours` removes id 2000000; in the third storage and rules are unchanged and the result is `failed`

### Requirement: Rules are fetched when the heartbeat version differs
After a heartbeat result `ok`, the controller SHALL fetch rules when `rulesVersion` differs from the stored `rulesVersion` (absent counts as different) and not otherwise. The request SHALL be `GET <baseUrl>/api/device/rules` with the single header `Authorization: Bearer <token>`.

#### Scenario: Newer version fetched and applied
- **GIVEN** stored `rulesVersion` 2, heartbeat answers `{ rulesVersion: 3 }`, rules answer `{ rulesVersion: 3, domains: ["a.com"], truncated: false }`
- **WHEN** `onAlarm` runs (`controller.test.ts`)
- **THEN** one `GET https://fg.example/api/device/rules` with headers exactly `{ Authorization: "Bearer tok-1" }` was made
- **AND** DNR rules equal `buildRules(["a.com"])`, and storage holds `rulesVersion` 3 and `rulesDomains` `["a.com"]`

#### Scenario: Same version, no fetch
- **GIVEN** stored `rulesVersion` 3, heartbeat answers `{ rulesVersion: 3 }`
- **WHEN** `onAlarm` runs (`controller.test.ts`)
- **THEN** no rules request and no DNR update happen

#### Scenario: First run without stored version
- **GIVEN** no stored `rulesVersion`, heartbeat answers `{ rulesVersion: 0 }`
- **WHEN** `onAlarm` runs (`controller.test.ts`)
- **THEN** rules are fetched once

#### Scenario: No fetch after a failed heartbeat or while rejected
- **GIVEN** the heartbeat fails (network, 500) or `authState` is `rejected`
- **WHEN** `onAlarm` runs (`controller.test.ts`)
- **THEN** no rules request is made

### Requirement: A failed sync keeps the working rules
If the rules request fails (network error, non-200 including 401, body not passing `RulesResponse`), if `updateDynamicRules` fails, or if storing the result fails, the extension SHALL keep the existing DNR rules and stored version, and retry at the next alarm.

#### Scenario: Server or network failure
- **GIVEN** stored version 2 and domains `["old.com"]`, and rules answer 500, a network error, a 401, or `{ domains: "x" }`
- **WHEN** `syncRules` runs (`rules.test.ts`)
- **THEN** no DNR update happens, storage still holds version 2 and `["old.com"]`, and the result is `failed`

#### Scenario: DNR update fails
- **GIVEN** a valid rules answer and `updateDynamicRules` rejects
- **WHEN** `syncRules` runs (`rules.test.ts`)
- **THEN** the stored version and domains are unchanged and the result is `failed`

#### Scenario: Retry on the next alarm
- **GIVEN** the first rules request failed and the second succeeds
- **WHEN** `onAlarm` runs twice (`controller.test.ts`)
- **THEN** the second run applies the rules and stores the new version

### Requirement: Rules persist and work offline
Enforcement SHALL rely on persisted dynamic rules and stored `rulesVersion` and `rulesDomains`, not on network access, and SHALL NOT be removed when authentication is rejected, the heartbeat fails or the device is offline.

#### Scenario: Offline alarm leaves rules alone
- **GIVEN** applied rules and a heartbeat that fails with a network error
- **WHEN** `onAlarm` runs (`controller.test.ts`)
- **THEN** `updateDynamicRules` is never called and stored rules are unchanged

#### Scenario: Rejection leaves rules alone
- **GIVEN** applied rules and a heartbeat answering 401
- **WHEN** `onAlarm` runs (`controller.test.ts`)
- **THEN** `authState` is `rejected` and `updateDynamicRules` is never called

### Requirement: Blocked attempts are recorded as domain and time only
The controller SHALL record `{ at, domain }` when the blocked page reports a domain that is in stored `rulesDomains`, only while a token exists. `at` SHALL be the ISO time of the report. The queue SHALL keep entries not older than 7 days and at most the newest 1000.

#### Scenario: Known domain recorded
- **GIVEN** a token and `rulesDomains` `["tiktok.com"]`
- **WHEN** `recordBlocked("tiktok.com", now)` runs (`controller.test.ts`)
- **THEN** `blockedQueue` is `[{ at: "2026-11-17T10:05:30.000Z", domain: "tiktok.com" }]`

#### Scenario: Unknown domain ignored
- **GIVEN** `rulesDomains` `["tiktok.com"]`
- **WHEN** `recordBlocked("evil.com", now)` or `recordBlocked("https://tiktok.com/x", now)` runs (`controller.test.ts`)
- **THEN** `blockedQueue` is unchanged

#### Scenario: Unpaired device records nothing
- **GIVEN** no token
- **WHEN** `recordBlocked("tiktok.com", now)` runs (`controller.test.ts`)
- **THEN** nothing is stored

#### Scenario: Queue limits
- **GIVEN** 1000 stored attempts, the oldest one more than 7 days old
- **WHEN** `addBlocked` adds one more (`blocked.test.ts`)
- **THEN** the old one is dropped, 1000 remain, and the new one is the last

#### Scenario: Over the cap
- **GIVEN** 1000 recent stored attempts
- **WHEN** `addBlocked` adds one more (`blocked.test.ts`)
- **THEN** the oldest attempt is dropped, 1000 remain, and the new one is the last

#### Scenario: Corrupt stored queue
- **GIVEN** stored values `undefined`, `"x"`, `[null, {"domain":"a.com"}, <valid attempt>]`
- **WHEN** `parseBlockedQueue` runs (`blocked.test.ts`)
- **THEN** it returns `[]`, `[]`, `[<valid attempt>]`

### Requirement: Blocked attempts are sent in the heartbeat
`flushQueue` SHALL add `blocked` (oldest first, at most 1000) to the first request of a flush unless `keepAliveOnly`, keep the original `at`, remove the sent attempts only after a `200`, and omit `blocked` when there are none. The body SHALL still pass `HeartbeatRequest`.

#### Scenario: Attempts included and cleared
- **GIVEN** `blockedQueue` with two attempts and an empty usage queue
- **WHEN** `flushQueue` runs and the server answers 200 (`sender.test.ts`)
- **THEN** the body has `blocked` equal to the two attempts with their original `at`, and `blockedQueue` is empty afterwards

#### Scenario: No attempts, no key
- **GIVEN** an empty `blockedQueue`
- **WHEN** `flushQueue` runs (`sender.test.ts`)
- **THEN** the body has exactly the keys `entries`, `currentDomain`, `browser`, `extensionVersion`

#### Scenario: Failure keeps attempts
- **GIVEN** two attempts queued
- **WHEN** the server answers 500, 401, 413 or the network fails (`sender.test.ts`)
- **THEN** `blockedQueue` still holds both

#### Scenario: Only the first chunk carries attempts
- **GIVEN** usage entries needing two chunks and one queued attempt
- **WHEN** `flushQueue` runs and both answer 200 (`sender.test.ts`)
- **THEN** the first request has `blocked` and the second has no `blocked` key

#### Scenario: Keep-alive carries none
- **GIVEN** `keepAliveOnly` and a queued attempt
- **WHEN** `flushQueue` runs (`sender.test.ts`)
- **THEN** the body has no `blocked` key and `blockedQueue` is unchanged

### Requirement: Re-pairing resets rule state
A successful `pairWithCode` SHALL, before storing the new token, in this order: remove `rulesVersion` in its own store call; remove every dynamic `declarativeNetRequest` rule (manual blocks, limit blocks and the allowed-hours rule 2000000) with `addRules: []`; then remove `rulesDomains`, `blockedQueue`, `rulesLimits`, `rulesTimezone`, `rulesOverrides`, `limitUsage`, `limitBlocked` and `rulesAllowedHours`. `pairWithCode` SHALL NOT touch alarms.

#### Scenario: Successful re-pair
- **GIVEN** a paired device with stored `rulesVersion` 4, `rulesDomains` `["a.example"]`, one queued attempt, limit state, `rulesAllowedHours`, and dynamic rules for `a.example`, a limit block and id 2000000
- **WHEN** pairing succeeds with a new token (`pairing.test.ts`)
- **THEN** the fake `dnr` holds no rule and the nine keys are absent
- **AND** `rulesVersion` was removed before the rules, and the rules were removed before the token was written

#### Scenario: New child's rules apply after the first sync
- **GIVEN** the state after the re-pair above and a rules response with domains `["b.example"]` for the new child
- **WHEN** `onAlarm` runs (`controller.test.ts`)
- **THEN** the only dynamic rule is the one for `b.example`, and `a.example` has none

#### Scenario: Stale domains are not evaluated after re-pair
- **GIVEN** the state after the re-pair and a rules fetch that fails
- **WHEN** `onAlarm` runs (`controller.test.ts`)
- **THEN** no dynamic rule exists for `a.example` and no limit rule is built from the old domains

### Requirement: A failed re-pair never leaves the device unblocked
A pairing that fails before the server accepts the code SHALL change nothing. If a step after the server accepted fails, `pairWithCode` SHALL keep the old token, return `failed`, and leave `rulesVersion` absent so the next sync rebuilds the rules.

#### Scenario: Removing the rules fails
- **GIVEN** the same state as the first scenario and a `dnr` whose `getDynamicRules` rejects, or whose `updateDynamicRules` rejects
- **WHEN** `pairWithCode` is called with a valid code (`pairing.test.ts`)
- **THEN** it returns `{ ok: false, reason: "failed" }` without throwing
- **AND** the old token and all stored keys other than `rulesVersion` are unchanged, `rulesVersion` may be absent, and the old rules are unchanged

#### Scenario: Store write fails after the rules were cleared
- **GIVEN** a device paired with `rulesVersion` 4, `rulesDomains` `["a.example"]` and a rule for `a.example`, and a store whose write after the rules clearing rejects
- **WHEN** `pairWithCode` is called with a valid code, then `onAlarm` runs with a heartbeat returning the same `rulesVersion` 4 and a rules response for `["a.example"]` (`controller.test.ts`)
- **THEN** pairing returned `failed`, the old token is still stored, and after the alarm the dynamic rule for `a.example` exists again

#### Scenario: Failed pair
- **GIVEN** the same state
- **WHEN** pairing fails with `invalid_code` (`pairing.test.ts`)
- **THEN** all keys and all dynamic rules are unchanged

### Requirement: Manifest grants only what blocking needs
`buildManifest(apiOrigin)` SHALL include permissions `tabs`, `idle`, `storage`, `alarms`, `declarativeNetRequest`, host permissions for the API origin and `<all_urls>`, `blocked.html` as web accessible to `<all_urls>`, `incognito: "not_allowed"`, and an `action` key (`{ default_title: "Family Guardian" }`, needed for the badge and not a permission), and no `declarativeNetRequestFeedback`.

#### Scenario: Manifest contents
- **GIVEN** apiOrigin `https://fg.example`
- **WHEN** `buildManifest` runs (`manifest.test.ts`)
- **THEN** the permissions, host permissions, `web_accessible_resources`, `incognito` and `action` equal the above exactly

### Requirement: Blocked message carries the domain only
The background SHALL accept from the blocked page only `{ type: "blocked", domain }` and use only the domain.

#### Scenario: Message parsing
- **GIVEN** the message `{ type: "blocked", domain: "tiktok.com", url: "https://tiktok.com/@x", title: "T" }`
- **WHEN** `parseBlockedMessage` runs (`blocked.test.ts`)
- **THEN** the result is `{ domain: "tiktok.com" }`
- **AND** a message with another `type`, a non-string `domain`, or a non-object value returns `null`
