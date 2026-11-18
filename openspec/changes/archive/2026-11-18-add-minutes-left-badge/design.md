# Design

- **Pure function** `minutesLeft(limits, seconds, category)` in `apps/extension/lib/limits.ts` (the file #87 creates): `left = minutesPerDay * 60 - seconds[category]`; returns `ceil(left / 60)` when `0 < left <= 300`, else `null`. Rounding up shows "5" from 5:00 down to 4:01 left and "1" until the limit is reached; at 0 the DNR block of #87 takes over.
- **Active category** comes from the tracker's current `domain` (already a registrable domain) categorized with `categorize(domain, rulesOverrides)`. A null domain, or no limit for the category, clears the badge. Focus and idle do not matter.
- **Stale usage**: if `limitUsage.day` differs from `dayKey(now, rulesTimezone)` the used seconds are 0, so the badge never shows yesterday's numbers.
- **Where it runs**: `updateBadge(now)` in the controller, called at the end of every `handleEvent` (with the event's `at`) and of `alarmNormal`; `alarmWhileRejected` clears the badge. It runs inside the existing serialized chain.
- **Port**: `ControllerDeps.badge?: { setBadgeText(d: { text: string }): Promise<unknown>; setBadgeBackgroundColor(d: { color: string }): Promise<unknown> }`, wired to `browser.action` in `background.ts`. Optional so existing tests are unchanged. Only text and color are passed.
- **Idempotent**: set the text every time (no in-memory "last shown", which a worker restart would lose). Set the color together with a non-empty text.
- **Failures never propagate**: a rejected badge call is caught and logged via `log`; tracking, queue and heartbeat continue.
- **Manifest**: `buildManifest` adds `action: { default_title: "Family Guardian" }`; this is a manifest key, not a permission. Without it `chrome.action` is undefined (WXT adds `action` only for a popup, and this extension has none), so the badge would never show.
- **Per browser**: each browser shows its own usage; usage in other browsers is not combined.
- Amber is `#F59E0B`. No ADR: nothing is stored or sent.
