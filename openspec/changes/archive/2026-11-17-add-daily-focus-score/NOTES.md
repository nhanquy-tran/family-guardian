# Notes: add-daily-focus-score (#6)

## What changed
- `packages/shared/src/focus.ts`: implemented `computeFocusScore` (group by minute, majority classification with ties to homework, switch counting within sessions split by gaps > 5 min, formula, clamp 0..100, `null` for empty day).
- `packages/shared/src/index.ts`: exports `./focus`.
- `tasks.md` ticked. Tests from the test-writer are unchanged.

## Verification
Each scenario in `specs/focus-score/spec.md` has a test in `packages/shared/src/focus.test.ts`; all 21 tests pass. `npm run check` and `npm run build` pass.

## For the human
- No privacy, DB or API impact: inputs are domain and seconds only.
- Invalid `minuteUtc` strings are not handled (assumed validated by the zod contract), per design.md.
