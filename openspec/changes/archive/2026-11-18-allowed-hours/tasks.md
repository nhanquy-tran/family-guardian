# Tasks

## Database
- [x] Migration: `children.allowed_start/allowed_end`, checks, column grant, bump trigger (skill `add-migration`); tests in `supabase/tests/allowed-hours.test.ts`

## Shared and web
- [x] `RulesResponse.allowedHours` in `packages/shared/src/contracts.ts`; test in `packages/shared/src/contracts.test.ts`
- [x] Rules store `findChild` returns `allowedHours`; `handleRules` includes it; tests in `supabase-store.test.ts`, `rules-endpoint.test.ts`
- [x] `apps/web/src/lib/allowed-hours.ts` (`saveAllowedHours`), `AllowedHoursCard`, server action on the rules page; tests in `allowed-hours.test.ts`, `allowed-hours-card.test.ts`

## Extension
- [x] `lib/hours.ts`: `inAllowedHours`, `nextEdge`, `buildHoursRule`; tests in `apps/extension/lib/hours.test.ts`
- [x] `Rule` condition gains `regexFilter`; `applyRules` never removes id 2000000; `syncRules` stores `rulesAllowedHours` and calls `reconcileHours`; tests in `rules.test.ts`
- [x] Controller: `reconcileHours` (rule presence from `getDynamicRules()`), `hours-edge` alarm, limit path keeps the rule, re-pair key reset; tests in `controller.test.ts`, `pairing.test.ts`
- [x] Block page `h` parameter; tests in `blocked.test.ts`
