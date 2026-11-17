## Context

Architecture flow 3: the extension counts seconds for the focused tab's domain while the user is active and posts per-domain seconds per minute. Issue #4 asks for the counting logic only, as a pure module the background script will feed later. `UsageEntry` (`minuteUtc`, `domain`, `seconds` 1..60) and `registrableDomain` already exist in `@fg/shared`.

## Goals / Non-Goals

**Goals:** pure, deterministic, unit-tested tracker; correct minute splitting; robust to sleep, duplicate events and clock jumps; ADR 0005 by construction.

**Non-Goals:** browser wiring, persistence, heartbeat sending, multi-window bookkeeping (see proposal, Out of scope).

## Decisions

1. **Reducer over plain data.** API (names may be refined by the developer, behaviour may not):
   ```ts
   type TrackerEvent =
     | { type: "tab"; at: number; url: string | null }
     | { type: "focus"; at: number; focused: boolean }
     | { type: "idle"; at: number; state: "active" | "idle" | "locked" }
     | { type: "tick"; at: number };
   createTracker(): TrackerState
   applyEvent(state: TrackerState, event: TrackerEvent): TrackerState
   takeCompletedEntries(state: TrackerState, now: number): { state: TrackerState; entries: UsageEntry[] }
   ```
   State is a plain JSON object (`lastAt`, `domain`, `focused`, `idle`, and a map `minuteStartMs -> domain -> ms`). A reducer needs no clock or timers, so tests pass explicit timestamps, and the background script can later store the state in `chrome.storage.session` when the MV3 worker is suspended. Alternative: a class with internal timers; rejected because it is harder to test and to persist.

2. **Reduce URL to domain at the edge.** The `tab` event handler calls `registrableDomain(url)` immediately and stores only the result (null for non-web URLs). The full URL never enters state (ADR 0005).

3. **Interval attribution.** On every event, the interval `[lastAt, at)` is credited to the *previous* state if it was counting (`focused && idle === "active" && domain !== null`), then the new state is applied and `lastAt = at`. Ticks exist only to close intervals.

4. **Accumulate milliseconds, emit floored seconds.** Accumulating ms avoids rounding drift; flooring each domain's total keeps the per-minute sum at or below 60. Each minute also keeps a total, and credits beyond 60 000 ms are dropped, which protects against clock jumps backwards.

5. **Gap cap of 120 s.** The background script will tick once a minute (`chrome.alarms` minimum is 30 s). A gap above 120 s means the device slept or the worker was suspended, so the whole interval counts zero. Crediting only up to the cap was rejected: it would invent up to two minutes of usage after every sleep. Backwards timestamps count zero and reset `lastAt`.

6. **Completed minutes only.** `takeCompletedEntries(now)` emits minutes with `minuteStart + 60 000 <= now`, sorted by minute then domain, and deletes them from state.

## Risks / Trade-offs

- A child reading one page with no events for over 2 minutes loses that time if ticks are missed → mitigated by the 1-minute tick the background will send.
- Sub-second tab switches lose up to 1 s per domain per minute through flooring → acceptable at minute granularity.
- `registrableDomain` uses a small suffix list, so some multi-part TLDs are grouped imprecisely → existing behaviour, out of scope.
