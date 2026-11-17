# Proposal

Implements GitHub issue #15 ("Extension: enforce block rules with declarativeNetRequest").

## Why

Parents can already manage block rules and the server serves them (`GET /api/device/rules`, #14), and the heartbeat returns `rulesVersion` (#10). The extension ignores both, so nothing is blocked. This change makes the extension fetch the rules when its version is stale, enforce them offline, show the blocked page, and report blocked attempts.

## What Changes

- Extension fetches `GET /api/device/rules` when the heartbeat's `rulesVersion` differs from the stored one, then replaces all dynamic DNR rules in one `updateDynamicRules` call and stores the version only after that succeeds.
- One DNR rule per domain: `main_frame` only, `requestDomains: [domain]` (matches subdomains), redirect to `/blocked.html?d=<domain>`.
- The blocked page sends `{ type: "blocked", domain }` to the background, which checks the domain against the stored rules and queues `{ at, domain }`.
- The sender adds queued attempts as `blocked` to the first heartbeat request of a flush and removes them after a `200`.
- Manifest: `declarativeNetRequest` and `<all_urls>` host permission (needed to redirect any site), `blocked.html` web accessible.
- Re-pairing clears the stored rules version and queued attempts, so the new pairing fetches its own rules.

## Capabilities

### New Capabilities

- `block-enforcement`: rules sync, DNR rule building, blocked page reporting, blocked attempts in the heartbeat, manifest.

### Modified Capabilities

None archived. Extends the unarchived heartbeat sender and pairing changes (`flushQueue`, `createController`, `pairWithCode`).

## Impact

- `apps/extension/lib/` (`rules.ts`, `blocked.ts`, `manifest.ts` new; `sender.ts`, `controller.ts`, `pairing.ts`, `storage.ts` extended), `apps/extension/entrypoints/` (`background.ts`, `blocked/`), `wxt.config.ts`, `docs/architecture.md`, `docs/platform-notes.md`.
- Privacy (ADR 0005): only blocked domain and time are sent, as the heartbeat already allows. The browser's address, path and title are never read: the domain comes from our own redirect rule. No new server data, so no new ADR.
- Depends on #14 (rules API, `blocked` on the heartbeat, `RulesResponse`) and the sender and pairing change (#10, #11), all on main. No new dependencies.

## Out of scope

- Allow lists, schedules, time limits, temporary unblock, per-site messages.
- Blocking sub-resources or non-main-frame requests; blocking in incognito or guest (disabled by policy).
- Notifying the parent of a blocked attempt immediately (it appears with the next heartbeat).
- Removing rules on unpair or rejection (rules stay in force; see design).
- Showing the child which rule matched.
