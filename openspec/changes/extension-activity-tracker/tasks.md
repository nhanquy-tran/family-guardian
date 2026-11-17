## 1. Tests first

- [ ] 1.1 Write `apps/extension/lib/tracker.test.ts` with one Vitest test per scenario in `specs/activity-tracking/spec.md` (use `T = Date.parse("2026-11-17T10:00:00.000Z")`, validate output with `UsageEntry.parse`). Confirm the tests fail because `tracker.ts` does not exist yet.

## 2. Implementation

- [ ] 2.1 Create `apps/extension/lib/tracker.ts` with the event types, `createTracker`, and `applyEvent` (URL reduced to registrable domain on entry; interval credited to previous state; gap cap 120 s; backwards clock counts zero).
- [ ] 2.2 Add minute splitting and the 60 000 ms per-minute cap to the accumulator.
- [ ] 2.3 Add `takeCompletedEntries` (completed minutes only, floored seconds, zeros omitted, removed after taking, sorted output).
- [ ] 2.4 Ensure the state is plain JSON (no `Map`, `Set` or class instances) and no full URL is ever stored.

## 3. Verify

- [ ] 3.1 Run `npm run check` and `npm run build`, and fix all failures.
