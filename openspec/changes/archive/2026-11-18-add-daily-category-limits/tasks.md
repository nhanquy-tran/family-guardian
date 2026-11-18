# Tasks

## 1. Tests first

- [x] 1.1 Write `supabase/tests/daily-limits.test.ts` (PGlite)
- [x] 1.2 Write `apps/web/src/lib/daily-limits.test.ts` and `apps/web/src/components/daily-limits-card.test.ts`
- [x] 1.3 Extend `packages/shared/src/contracts.test.ts`, `apps/web/src/lib/device/rules-endpoint.test.ts` and `apps/web/src/lib/device/supabase-store.test.ts`

## 2. Implementation

- [x] 2.1 Migration `<utc timestamp>_child_category_limits.sql` with the limits table, its bump trigger and the families timezone trigger (use the `add-migration` skill)
- [x] 2.2 `RulesResponse` fields in `packages/shared/src/contracts.ts`
- [x] 2.3 `lib/daily-limits.ts`
- [x] 2.4 `DailyLimitsCard`, `saveLimitsAction`, rules page wiring
- [x] 2.5 `rules-endpoint.ts` and `supabase-store.ts` (`timezone`, `listLimits`)

## 3. Finish

- [x] 3.1 `npm run check` and `npm run build` pass
- [x] 3.2 `NOTES.md` lists docs to update (`docs/architecture.md`: new table and rules response fields; `docs/platform-notes.md`: `bump_rules_version()` bumps twice on UPDATE, and the timezone trigger)
