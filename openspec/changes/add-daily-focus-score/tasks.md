## 1. Tests first

- [ ] 1.1 Create `packages/shared/src/focus.test.ts` with one Vitest test per scenario in `specs/focus-score/spec.md` (Only homework, Empty homework list, No entries, One switch in one session, Gap over 5 minutes, Gap of exactly 5 minutes, Mixed minute, Tied minute, Unordered input, Penalty capped at 20, Negative score clamped to 0); confirm they fail

## 2. Implementation

- [ ] 2.1 Create `packages/shared/src/focus.ts` exporting `FocusScore` type and `computeFocusScore(entries, homeworkDomains)` as described in `design.md` (group by minute, classify, count switches per session, apply formula, clamp)
- [ ] 2.2 Export it from `packages/shared/src/index.ts`

## 3. Verify

- [ ] 3.1 Run `npm run check` and `npm run build` and fix all failures
