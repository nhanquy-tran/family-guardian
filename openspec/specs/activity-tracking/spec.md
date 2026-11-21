# activity-tracking Specification

## Purpose
Turn browser tab, window-focus and idle events on the child's device into per-domain seconds per minute, counting only active, focused, http(s) use and never storing full URLs or titles (ADR 0005).

## Requirements

### Requirement: Tracker accepts tab, focus, idle and tick events

The tracker SHALL accept events with a millisecond epoch timestamp: tab changed (`url` or null), window focus changed, idle state changed (`active`, `idle`, `locked`), and tick. It SHALL use no browser APIs.

All scenarios in this capability are tested in `apps/extension/lib/tracker.test.ts`. `T` is `2026-11-17T10:00:00.000Z`; `10:00` is that minute.

#### Scenario: Fresh tracker counts nothing
- **GIVEN** a fresh tracker (no URL, no focused window, idle state `active`)
- **WHEN** a tick at T and a tick at T+30 s are applied
- **THEN** taking completed entries at T+60 s returns an empty list

### Requirement: Tracker state is plain JSON

The tracker state SHALL be plain JSON-serializable data, so a later change can persist it across service-worker restarts.

#### Scenario: State survives a JSON round trip
- **GIVEN** a tracker with focused window and tab `https://www.youtube.com/watch?v=abc` since T
- **WHEN** its state is serialized with `JSON.stringify`, parsed back, and a tick at T+60 s is applied to the parsed state
- **THEN** taking completed entries at T+60 s returns `[{ minuteUtc: "2026-11-17T10:00:00.000Z", domain: "youtube.com", seconds: 60 }]`

### Requirement: Seconds count only while focused, active and on http(s)

The tracker SHALL attribute the time between two consecutive events to the current domain only if, during that interval, a browser window was focused, the idle state was `active`, and the focused tab URL had an `http:` or `https:` scheme. Otherwise that interval SHALL count zero seconds.

#### Scenario: Active focused http(s) tab is counted
- **GIVEN** window focused and tab `https://www.youtube.com/watch?v=abc` at T
- **WHEN** ticks are applied at T+40 s and T+60 s with no state change, and completed entries are taken at T+60 s
- **THEN** the entries are `[{ minuteUtc: "2026-11-17T10:00:00.000Z", domain: "youtube.com", seconds: 60 }]`

#### Scenario: Window focus lost stops counting
- **GIVEN** window focused and tab `https://example.com/` at T
- **WHEN** window focus is lost at T+20 s and a tick is applied at T+60 s
- **THEN** completed entries at T+60 s are `[{ minuteUtc: "2026-11-17T10:00:00.000Z", domain: "example.com", seconds: 20 }]`

#### Scenario: Window focus regained resumes counting
- **GIVEN** tab `https://example.com/` at T and window focus lost
- **WHEN** window focus is gained at T+45 s and a tick is applied at T+60 s
- **THEN** completed entries at T+60 s contain `example.com` with 15 seconds

#### Scenario: Idle or locked stops counting
- **GIVEN** window focused and tab `https://example.com/` at T
- **WHEN** idle state becomes `idle` at T+10 s, `active` at T+30 s, `locked` at T+50 s, and a tick is applied at T+60 s
- **THEN** completed entries at T+60 s contain `example.com` with 30 seconds

#### Scenario: Non-web tabs are not counted
- **GIVEN** window focused at T
- **WHEN** the tab URL is `chrome://extensions` at T, `file:///C:/x.html` at T+20 s, null at T+40 s, and a tick is applied at T+60 s
- **THEN** completed entries at T+60 s are an empty list

### Requirement: Time is attributed to the registrable domain of the tab

The tracker SHALL attribute each counted interval to `registrableDomain(url)` from `@fg/shared` for the URL that was focused during that interval. Switching tabs SHALL attribute time before the switch to the previous domain and time after it to the new domain. Different URLs with the same registrable domain SHALL be summed into one entry per minute.

#### Scenario: Tab switch splits time between domains
- **GIVEN** window focused and tab `https://www.youtube.com/watch?v=abc` at T
- **WHEN** the tab changes to `https://docs.google.com/document/d/1` at T+25 s and a tick is applied at T+60 s
- **THEN** completed entries at T+60 s are `youtube.com` with 25 seconds and `google.com` with 35 seconds, both with `minuteUtc` `2026-11-17T10:00:00.000Z`

#### Scenario: Subdomains are merged into one entry
- **GIVEN** window focused and tab `https://m.facebook.com/a` at T
- **WHEN** the tab changes to `https://www.facebook.com/b` at T+30 s and a tick is applied at T+60 s
- **THEN** completed entries at T+60 s are exactly one entry: `facebook.com` with 60 seconds

### Requirement: Time is split at UTC minute boundaries

The tracker SHALL split every counted interval at UTC minute boundaries and add each part to the minute it falls in. `minuteUtc` SHALL be the ISO 8601 UTC start of that minute with zero seconds and milliseconds (e.g. `2026-11-17T10:00:00.000Z`).

#### Scenario: Interval crossing a minute boundary is split
- **GIVEN** window focused and tab `https://example.com/` at T+50 s
- **WHEN** ticks are applied at T+70 s and T+120 s, and completed entries are taken at T+120 s
- **THEN** the entries are `example.com` 10 seconds for `2026-11-17T10:00:00.000Z` and `example.com` 60 seconds for `2026-11-17T10:01:00.000Z`

### Requirement: Only completed minutes are emitted, once, as valid UsageEntry objects

Taking entries at time `now` SHALL return entries only for minutes that end at or before `now`, and SHALL remove them from the tracker so they are never returned twice. Time in the current, unfinished minute SHALL stay in the tracker. Seconds SHALL be whole numbers rounded down; entries with 0 seconds SHALL be omitted. Every returned entry SHALL pass `UsageEntry.parse` from `@fg/shared`.

#### Scenario: Current minute is kept until it ends
- **GIVEN** window focused and tab `https://example.com/` at T
- **WHEN** a tick is applied at T+30 s and completed entries are taken at T+30 s
- **THEN** the result is an empty list, and after a tick at T+60 s taking entries at T+60 s returns `example.com` with 60 seconds

#### Scenario: Entries are returned only once
- **GIVEN** a tracker that has returned the entries for minute `2026-11-17T10:00:00.000Z`
- **WHEN** completed entries are taken again at T+60 s
- **THEN** the result is an empty list

#### Scenario: Fractions are rounded down and zero entries omitted
- **GIVEN** window focused and tab `https://a.com/` at T
- **WHEN** the tab changes to `https://b.com/` at T+0.4 s, to `https://c.com/` at T+30.9 s, and a tick is applied at T+60 s
- **THEN** completed entries at T+60 s contain `b.com` with 30 seconds and `c.com` with 29 seconds, and no entry for `a.com`

#### Scenario: Output matches the shared contract
- **GIVEN** any of the scenarios in this spec
- **WHEN** completed entries are taken
- **THEN** every entry passes `UsageEntry.parse` and has exactly the keys `minuteUtc`, `domain` and `seconds`

### Requirement: Seconds per minute never exceed 60

The sum of `seconds` over all entries for the same `minuteUtc` SHALL never exceed 60, regardless of the order, timing or repetition of events. Once a minute holds 60 counted seconds in total, further time for that minute SHALL be discarded.

#### Scenario: Rapid switching within one minute stays within 60
- **GIVEN** window focused at T
- **WHEN** the tab alternates between `https://a.com/` and `https://b.com/` every 0.7 s from T to T+60 s and a tick is applied at T+60 s
- **THEN** the seconds of all entries for `2026-11-17T10:00:00.000Z` sum to at most 60

#### Scenario: Duplicate events do not double count
- **GIVEN** window focused and tab `https://example.com/` at T
- **WHEN** ticks are applied twice at T+30 s, the same tab URL is reported again at T+30 s, and a tick is applied at T+60 s
- **THEN** completed entries at T+60 s are `example.com` with 60 seconds

### Requirement: Sleep, long gaps and clock jumps produce no large entries

If the time between two consecutive events is more than 120 seconds, the tracker SHALL count zero seconds for that whole interval (the laptop slept or the background worker was suspended). If an event's timestamp is earlier than the previous event's timestamp, the tracker SHALL count zero seconds for it, still apply its state change, and continue from the new timestamp.

#### Scenario: Laptop sleeps for hours
- **GIVEN** window focused and tab `https://example.com/` at T, with a tick at T+60 s
- **WHEN** the next event is a tick at T+3 h, followed by a tick at T+3 h+60 s
- **THEN** completed entries taken at T+3 h+60 s are `example.com` 60 seconds for `10:00`, `example.com` 60 seconds for `13:00`, and nothing for any minute in between

#### Scenario: Gap of exactly 120 seconds is still counted
- **GIVEN** window focused and tab `https://example.com/` at T
- **WHEN** the next event is a tick at T+120 s
- **THEN** completed entries at T+120 s are `example.com` 60 seconds for `10:00` and 60 seconds for `10:01`

#### Scenario: Clock moves backwards
- **GIVEN** window focused and tab `https://example.com/` at T, and a tick at T+50 s
- **WHEN** a tick at T+20 s is applied (clock jumped back), followed by a tick at T+60 s
- **THEN** completed entries taken at T+60 s are exactly `example.com` with 60 seconds for `10:00` (50 + 40 seconds capped at 60)

### Requirement: No URLs, paths or titles are stored or output

The tracker SHALL NOT keep a full URL, path, query, fragment or page title in its state or output (ADR 0005). It SHALL reduce every reported URL to its registrable domain (or null for non-web URLs) when the event is applied.

#### Scenario: State and output contain only the domain
- **GIVEN** a fresh tracker
- **WHEN** window focus is gained at T, tab `https://www.youtube.com/watch?v=secret123#t=5` is reported at T, and a tick is applied at T+60 s
- **THEN** `JSON.stringify` of the tracker state and of the taken entries contains `youtube.com` but not `watch`, `secret123`, `#t=5`, `https://` or `www.youtube.com`

### Requirement: Switching browsers never counts a second twice
Each browser SHALL credit time only while one of its windows has focus. With two browsers running, the seconds credited by both trackers together SHALL NOT exceed the elapsed wall time.

#### Scenario: Focus handoff between two browsers
- **GIVEN** two independent tracker states A and B on `example.com`, both idle-active, A focused from `2026-11-17T10:00:00Z` (`tracker.test.ts`)
- **WHEN** at `10:00:30Z` A gets a focus-lost event and B a focus-gained event, and at `10:01:00Z` B gets a focus-lost event and A a focus-gained event, then both get a tick at `10:01:30Z`
- **THEN** A has credited 60 seconds and B 30 seconds in total (90 seconds for 90 seconds of wall time)
- **AND** when both get a focus-lost event at `10:01:30Z` and a tick at `10:03:00Z`, neither credits any seconds between `10:01:30Z` and `10:03:00Z`
