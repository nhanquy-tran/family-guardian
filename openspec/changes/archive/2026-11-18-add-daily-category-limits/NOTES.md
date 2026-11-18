# Notes

## Summary

- Migration `20261118130000_child_category_limits.sql`: limits table (RLS, grants, bump trigger via the existing `bump_rules_version()`), plus a families timezone trigger bumping children's `rules_version`.
- `RulesResponse` gains `limits` (default `[]`, no duplicates) and optional `timezone`.
- `lib/daily-limits.ts`, `DailyLimitsCard`, `saveLimitsAction` and rules page wiring.
- `rules-endpoint.ts` returns limits and timezone; `supabase-store.ts` reads the family timezone (join through `children.families`) and `listLimits`.
- Each scenario is verified by the tests written first: `supabase/tests/daily-limits.test.ts`, `lib/daily-limits.test.ts`, `components/daily-limits-card.test.ts`, `contracts.test.ts`, `rules-endpoint.test.ts`, `supabase-store.test.ts`. `npm run check` and `npm run build` pass.

## Docs to update

- `docs/architecture.md`: new table `child_category_limits` and the `limits` / `timezone` fields of the rules response.
- `docs/platform-notes.md`: `bump_rules_version()` bumps twice on UPDATE; the families timezone trigger.
