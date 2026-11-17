## Why

Issue #4. The extension must turn browser activity into per-domain seconds per minute before any heartbeat can be sent (architecture flow 3, "Track"). This logic is the heart of the product and easy to get wrong (minute boundaries, idle, sleeping laptops), so it should live in a pure, unit-tested module with no browser APIs, fed by the background script in a later change.

## What Changes

- Add `apps/extension/lib/tracker.ts`: a pure state machine that accepts four kinds of timestamped events (focused tab URL changed, window focus changed, idle state changed, clock tick) and accumulates active seconds per registrable domain per UTC minute.
- Seconds count only while a browser window is focused, the idle state is `active`, and the focused tab is an http(s) URL.
- Completed minutes are returned as `UsageEntry` objects (`{ minuteUtc, domain, seconds }`) from `packages/shared`, using `registrableDomain`.
- Gaps between events longer than 120 s (sleep, suspended worker) count as zero, so no huge entries are produced.
- Total seconds in one minute never exceed 60.
- Add `apps/extension/lib/tracker.test.ts` covering every scenario.

## Capabilities

### New Capabilities

- `activity-tracking`: how the extension converts tab, focus, idle and clock events into per-domain seconds per minute, under the ADR 0005 privacy limits.

### Modified Capabilities

None.

## Impact

- New files only: `apps/extension/lib/tracker.ts`, `apps/extension/lib/tracker.test.ts`. Already matched by the root `vitest.config.ts`.
- Uses existing `UsageEntry` and `registrableDomain` from `@fg/shared`; no contract change, no new dependency.
- Privacy: the tracker state and output hold only registrable domains, timestamps and seconds (ADR 0005). No new ADR needed.

## Out of scope

- Wiring to `chrome.tabs`, `chrome.windows`, `chrome.idle` or `chrome.alarms` in `background.ts`.
- Persisting tracker state across MV3 service-worker restarts (state is plain JSON so a later change can store it).
- Heartbeat sending, offline queue, `currentDomain` field, blocking, categories and focus score.
- Multiple browser windows beyond "some window of this browser is focused"; the background script reports the focused tab.
