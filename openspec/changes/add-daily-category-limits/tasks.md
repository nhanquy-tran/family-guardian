# Tasks

## 1. Tests first

- [ ] 1.1 Write `supabase/tests/daily-limits.test.ts` (PGlite)
- [ ] 1.2 Write `apps/web/src/lib/daily-limits.test.ts` and `apps/web/src/components/daily-limits-card.test.ts`
- [ ] 1.3 Extend `packages/shared/src/contracts.test.ts`, `apps/web/src/lib/device/rules-endpoint.test.ts` and `apps/web/src/lib/device/supabase-store.test.ts`

## 2. Implementation

- [ ] 2.1 Migration `<utc timestamp>_child_category_limits.sql` (use the `add-migration` skill)
- [ ] 2.2 `RulesResponse` fields in `packages/shared/src/contracts.ts`
- [ ] 2.3 `lib/daily-limits.ts`
- [ ] 2.4 `DailyLimitsCard`, `saveLimitsAction`, rules page wiring
- [ ] 2.5 `rules-endpoint.ts` and `supabase-store.ts` (`timezone`, `listLimits`)

## 3. Finish

- [ ] 3.1 `npm run check` and `npm run build` pass
- [ ] 3.2 `NOTES.md` lists docs to update (`docs/architecture.md`: new table and rules response fields)
