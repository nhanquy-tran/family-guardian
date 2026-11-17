# Design

## Context

Architecture flow 4 (Block). On main: `flushQueue` (returns `rulesVersion`, unused), `createController` (`onAlarm`), `pairWithCode`, `KeyValueStore`/`Post` in `lib/storage.ts`; shared `RulesResponse`, `BlockedAttempt`, `MAX_BLOCKED_ATTEMPTS = 1000`, `MAX_RULE_DOMAINS = 5000`, optional `blocked` on `HeartbeatRequest`. `entrypoints/blocked/index.html` exists (output `/blocked.html`). Logic stays in `lib/` with injected dependencies, so tests need no browser.

## Goals / Non-Goals

**Goals:** rules enforced offline and across restarts; a failed fetch never removes working rules; blocked attempts reported once with their original time; no URL ever read.

**Non-Goals:** see proposal.

## Decisions

1. **Storage keys** (added to `chrome.storage.local`): `rulesVersion` (non-negative integer), `rulesDomains` (string[]), `blockedQueue` (`BlockedAttempt[]`). Validated on read: wrong types count as absent / empty; `parseBlockedQueue` keeps items that pass `BlockedAttempt`.

2. **Rule building** (`lib/rules.ts`). `buildRules(domains)`: keeps domains matching `^[a-z0-9-]+(\.[a-z0-9-]+)+$` (at most 253 chars), deduplicates, takes at most `MAX_RULE_DOMAINS`, and returns rules `{ id: i + 1, priority: 1, action: { type: "redirect", redirect: { extensionPath: "/blocked.html?d=" + domain } }, condition: { requestDomains: [domain], resourceTypes: ["main_frame"] } }`. `requestDomains` matches the domain and all its subdomains. Nothing is read from the navigation: the domain in the redirect is ours.

3. **Applying** (`applyRules(dnr, domains)`) with `dnr: { getDynamicRules(): Promise<{ id: number }[]>; updateDynamicRules(o: { removeRuleIds: number[]; addRules: Rule[] }): Promise<void> }`. It reads the existing ids and calls `updateDynamicRules` once with `removeRuleIds` = all existing ids and `addRules` = built rules. The browser applies one call atomically, so a failure leaves the old rules. Dynamic rules persist across restarts, so enforcement works offline without any code running.

4. **Fetching** (`syncRules(deps)`), called by the controller after a heartbeat result `ok` (not while rejected) when `rulesVersion !== stored rulesVersion` (absent counts as different). `GET ${baseUrl}/api/device/rules` with header `Authorization: Bearer <token>`; needs a new `Get` type and `fetchGet` (timeout 30 s) in `lib/storage.ts`. Body must pass `RulesResponse`. Then `applyRules`, then store `rulesDomains` and `rulesVersion` (the version from the rules response, not the heartbeat, so a race only causes one extra fetch). Any failure (network, non-200, invalid body, DNR error, storage error) keeps old rules and version and is retried at the next alarm (one minute). `401` on rules is treated as a failure, not as rejection: the heartbeat decides authentication. `truncated: true` is applied as received.

5. **Blocked page and report.** `entrypoints/blocked/main.ts` reads `d` from `location.search` and sends `browser.runtime.sendMessage({ type: "blocked", domain })`, and shows the domain in the page. `background.ts` parses the message with `parseBlockedMessage(raw): { domain: string } | null` (`lib/blocked.ts`; only `type: "blocked"` with a string `domain`, other fields dropped) and calls `controller.recordBlocked(domain, now)`. `recordBlocked` (serialized with the other controller calls) ignores the call unless a token exists and `domain` is in stored `rulesDomains` (a page cannot inject arbitrary domains; only extension pages can message the background, there is no `externally_connectable`), then appends `{ at: new Date(now).toISOString(), domain }` to `blockedQueue`, keeping only entries not older than 7 days and the newest `MAX_BLOCKED_ATTEMPTS`. Reloading the blocked page counts again; accepted.

6. **Sending.** `flushQueue` reads `blockedQueue` (pruned the same way) and, unless `keepAliveOnly`, adds `blocked` (the oldest up to 1000) to the **first** request only. After a `200` for that request, the sent attempts are removed from storage; `failed`, `unauthorized` or `413` keep them. With an empty queue, `blocked` is omitted from the body. The original `at` is kept on resend (idempotent on the server through its unique key). The body is still built through `HeartbeatRequest.parse`.

7. **Rejected, unpaired.** Rules already in the browser keep blocking when authentication is rejected or the device is unpaired; removing protection because of a server problem is worse than a stale list. Successful `pairWithCode` also removes `rulesVersion` and `blockedQueue` (attempts belong to the old pairing; the missing version forces a fetch that replaces the old child's rules).

8. **Manifest** (`lib/manifest.ts`, `buildManifest(apiOrigin)`, used by `wxt.config.ts`): permissions `tabs, idle, storage, alarms, declarativeNetRequest`; `host_permissions: [apiOrigin + "/*", "<all_urls>"]` (redirect needs host access to the blocked sites); `web_accessible_resources: [{ resources: ["blocked.html"], matches: ["<all_urls>"] }]` (a redirect to an extension page requires it); `incognito: "not_allowed"` unchanged. No `declarativeNetRequestFeedback`.

9. **Wiring.** `createController` deps gain `get: Get` and `dnr`. `background.ts` passes `fetchGet` and `browser.declarativeNetRequest`, and handles the `blocked` message next to `pair`. Existing controller tests add the two fakes.

## Risks / Trade-offs

- [`<all_urls>` host permission] Store review looks at it; justified in the listing text (blocking any site a parent chooses). Recorded in `docs/platform-notes.md`.
- [Chrome dynamic rule limits] 5000 redirect rules equals the guaranteed unsafe-rule limit; `MAX_RULE_DOMAINS` keeps us within it.
- [Reloading the blocked page inflates counts] Accepted for MVP.
- [Attempts lost if the page closes before messaging] Possible; the block itself still holds.
- [Redirect rules do not apply to a page already open] Only navigations are blocked; a tab open before the rule arrives keeps working until it navigates.
