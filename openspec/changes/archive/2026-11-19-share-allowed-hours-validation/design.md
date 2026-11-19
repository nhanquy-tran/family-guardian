## Decisions
- Put the new exports in `packages/shared/src/contracts.ts` (already exported), so the hot file `index.ts` is untouched.
- `parseAllowedHours(start: unknown, end: unknown): AllowedHours | null` is pure, does not trim, and returns null for non-strings, a non-matching value or equal values. Midnight crossing (start > end) is valid.
- Web `saveAllowedHours` keeps its trim and its empty-clears step, then calls `parseAllowedHours`.
- Extension `parseHours` becomes a call to `parseAllowedHours` on the object's fields; `hours.ts` imports the type and no longer exports `AllowedHours`.
- The contract's `allowedHours` schema uses `HHMM_PATTERN` and the same equality rule; accepted and rejected inputs are unchanged.
- Order against other open changes does not matter: none touch these files.
