## ADDED Requirements

### Requirement: Switching browsers never counts a second twice
Each browser SHALL credit time only while one of its windows has focus. With two browsers running, the seconds credited by both trackers together SHALL NOT exceed the elapsed wall time.

#### Scenario: Focus handoff between two browsers
- **GIVEN** two independent tracker states A and B on `example.com`, both idle-active, A focused from `2026-11-17T10:00:00Z` (`tracker.test.ts`)
- **WHEN** at `10:00:30Z` A gets a focus-lost event and B a focus-gained event, and at `10:01:00Z` B gets a focus-lost event and A a focus-gained event, then both get a tick at `10:01:30Z`
- **THEN** A has credited 60 seconds and B 30 seconds in total (90 seconds for 90 seconds of wall time)
- **AND** when both get a focus-lost event at `10:01:30Z` and a tick at `10:03:00Z`, neither credits any seconds between `10:01:30Z` and `10:03:00Z`
