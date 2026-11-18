# Tasks

## Database
- [ ] Migration: `children.allowed_start/allowed_end`, checks, column grant, bump trigger (skill `add-migration`); tests in `supabase/tests/allowed-hours.test.ts`

## Shared and web
- [ ] `RulesResponse.allowedHours` in `packages/shared/src/contracts.ts`; test in `packages/shared/src/contracts.test.ts`
- [ ] Rules store `findChild` returns `allowedHours`; `handleRules` includes it; tests in `supabase-store.test.ts`, `rules-endpoint.test.ts`
- [ ] `apps/web/src/lib/allowed-hours.ts` (`saveAllowedHours`), `AllowedHoursCard`, server action on the rules page; tests in `allowed-hours.test.ts`, `allowed-hours-card.test.ts`

## Extension
- [ ] `lib/hours.ts`: `inAllowedHours`, `nextEdge`, `buildHoursRule`; tests in `apps/extension/lib/hours.test.ts`
- [ ] `Rule` condition gains `regexFilter`; `applyRules` never removes id 2000000; `syncRules` stores `rulesAllowedHours` and calls `reconcileHours`; tests in `rules.test.ts`
- [ ] Controller: `reconcileHours` (rule presence from `getDynamicRules()`), `hours-edge` alarm, limit path keeps the rule, re-pair key reset; tests in `controller.test.ts`, `pairing.test.ts`
- [ ] Block page `h` parameter; tests in `blocked.test.ts`
