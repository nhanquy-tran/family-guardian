## Summary
- `contracts.ts`: `HHMM_PATTERN`, `AllowedHours`, `parseAllowedHours` implemented; `RulesResponse.allowedHours` uses `HHMM_PATTERN`.
- Extension `hours.ts`: `parseHours` calls `parseAllowedHours`; local pattern and type removed.
- Web `allowed-hours.ts`: keeps trim and clear step, then `parseAllowedHours`; local pattern removed.
- Scenarios (valid parse, invalid null) verified by `packages/shared/src/contracts.test.ts`; existing extension and web tests still pass. `npm run check` and `npm run build` pass.

## Docs to update
- None.
