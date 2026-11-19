Depends on: none
Touches: allowed-hours

# Share the allowed-hours validation in packages/shared

## Why
The HH:MM rule and the start-not-equal-end check exist three times in TypeScript (`packages/shared/src/contracts.ts`, `apps/extension/lib/hours.ts` with its own `AllowedHours` type, `apps/web/src/lib/allowed-hours.ts`). Found by the weekly architecture check (#139, finding 2). Issue #141.

## What changes
- `packages/shared` exports `HHMM_PATTERN`, the `AllowedHours` type and `parseAllowedHours(start, end)`, next to the contract in `contracts.ts`.
- The contract, the extension and the web app use them; the extension drops its own type.
- No behaviour change.

## Out of scope
- The SQL check in the migration stays.
- No change to the contract, API, storage or UI behaviour.
