# Notes

## Summary
- `lib/category-overrides.ts`: list/save (upsert on `family_id,domain`)/remove with the session client.
- `CategoryOverridesView`, page and server actions at `/dashboard/categories`; "Categories" nav item.
- `summarizeDay`, `summarizeWeek`, `buildTimeline` take an optional overrides map; `loadUsage` reads `domain_categories` (global first, family wins) and returns `overrides`; a query failure gives `status: "error"`.
- Usage top sites have a "Change category" link and a wrapping row.
- Each scenario is verified by the test file named in its spec; DB scenarios use existing migrations (no new migration).

## Test concerns
`npm run check`: all other tests pass; two tests look wrong against spec/main and were not worked around. `npm run build` was not run (check is not green).

1. `apps/web/src/components/usage-change-category.test.ts` "Top sites link to the categories form": both domains have equal seconds (120), and `topSites` (shared, unchanged, out of scope) sorts ties alphabetically. Links come out `docs.google.com`, `youtube.com`; the test expects `youtube.com` first (input order). Fix the test: give the domains different seconds, or expect the alphabetical order.

2. `supabase/tests/category-overrides.test.ts` "Family changes bump every child of the family only", step 2 (update): expects +1, gets +2. The existing `bump_family_rules_version` in `20261117100000_heartbeat.sql` bumps once for `old.family_id` and again for `new.family_id` on UPDATE, even when both are the same family. The change's design says "No migration" and the proposal says the trigger already exists. Either relax the test to accept an increase on update, or add a new migration so an update within the same family bumps once (the applied migration cannot be edited). The debugger/owner should decide.

## Docs to update
- `docs/architecture.md`: add the `/dashboard/categories` page if it lists pages.

## Debugging

1. `usage-change-category.test.ts` "Top sites link to the categories form": verdict **test**. Root cause: both domains had 120 s and shared `topSites` breaks ties alphabetically; the spec does not define the link order. Change: `result()` gives descending seconds by input order (`120 + (n - i) * 60`). The assertion is unchanged.
2. `supabase/tests/category-overrides.test.ts` "Family changes bump every child of the family only": verdict **code**. Root cause: `bump_family_rules_version` (20261117100000) bumps for `old.family_id` and again for `new.family_id` on UPDATE, giving +2. The spec says each step increases `rules_version` by 1. Change: new migration `20261118130100_family_rules_bump_once.sql` (`create or replace`; on UPDATE the new family is bumped only if the family changed). This departs from design.md "No migration", so update the design.

Evidence: `npx vitest run supabase/tests apps/web/src/components/usage-change-category.test.ts` passes (13 files, 112 tests). `npm run check`, `npm run build` and `check-migrations.sh` were not run by the debugger.
