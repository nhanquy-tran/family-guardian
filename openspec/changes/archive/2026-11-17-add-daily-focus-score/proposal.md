## Why

Parents need one simple number per child per day that says how focused the child was on homework (architecture, flow 5 "Focus score"). The formula must live in `packages/shared` so the dashboard and any later consumer compute it the same way. Implements GitHub issue #6.

## What Changes

- Add a pure function in `packages/shared/src/focus.ts`, exported from `@fg/shared`, that takes one day's usage entries (minute, domain, seconds) and the child's homework domains and returns `{ score, homeworkSeconds, totalSeconds, switches }`.
- `homeworkShare = homeworkSeconds / totalSeconds`.
- A switch is counted when two consecutive active minutes of the same session differ in kind (homework vs. non-homework). Minutes more than 5 minutes apart start a new session; the jump between sessions is not a switch.
- `score = round(homeworkShare * 100 - min(20, switchesPerActiveHour * 2))`, clamped to 0..100.
- An empty day (no entries, or zero total seconds) returns `score: null`.
- Unit tests in `packages/shared/src/focus.test.ts`.

## Capabilities

### New Capabilities
- `focus-score`: compute a child's daily focus score from per-minute domain usage and homework domains.

### Modified Capabilities
None.

## Out of scope

- Resolving homework *categories* to domains (the `domain_categories` lookup). The caller passes the resolved list of homework domains.
- Picking the day's entries, time zones and day boundaries (the caller passes one day's entries).
- Showing the score on the dashboard, storing it, or any API/DB change.
- Subdomain or wildcard matching of homework domains (entries are already registrable domains).
- Weekly or multi-day aggregates.

## Impact

- New file `packages/shared/src/focus.ts` and its test; one export line in `packages/shared/src/index.ts`.
- Reuses the existing `UsageEntry` type from `contracts.ts`. No new dependencies, no data collection change (ADR 0005 unaffected: inputs are domain and seconds only).
