# Notes: extension-activity-tracker (#4)

## What changed

- `apps/extension/lib/tracker.ts`: implemented `createTracker`, `applyEvent`, `takeCompletedEntries` as a pure reducer over plain-JSON state. The URL is reduced to `registrableDomain` when the `tab` event is applied and never stored.
  - Each interval is credited to the previous state, split at UTC minute boundaries, and capped at 60 000 ms per minute across all domains.
  - Gaps over 120 s and backwards timestamps count zero.
  - `takeCompletedEntries` emits only finished minutes, floors seconds, omits zeros, removes emitted minutes, and sorts by minute then domain.
- `packages/shared/src/focus.ts`: small type-safety fix with no behaviour change. The tracker is the first extension code importing a value from `@fg/shared`, so the extension's stricter tsconfig (`noUncheckedIndexedAccess` from WXT) now type-checks that file and flagged `keys[i]`.
- Tests (`tracker.test.ts`) were not modified.

## How each scenario is verified

Every scenario in `specs/activity-tracking/spec.md` has a matching test in `apps/extension/lib/tracker.test.ts`. The `take` helper also checks `UsageEntry.parse` and the exact key set on every output entry. `npm run check` (40 tests pass) and `npm run build` both pass.

## For the human to check

- The `focus.ts` edit is outside the change's listed files; it was needed for the extension typecheck.
- Wiring to `chrome.*` APIs and state persistence are left to a later change, as stated in the proposal.
