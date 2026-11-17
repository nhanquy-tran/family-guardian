# Notes: add-focus-dashboard (#16)

## What changed
- Migration `20261118110100_homework_settings.sql`: `children.homework_domains` (check via immutable function `homework_domains_valid`, because CHECK cannot hold a subquery), column grant, default `{education}` for `homework_categories`, backfill of empty lists.
- `homeworkDomainsFor` (shared), `lib/homework.ts`, `lib/focus-overview.ts`, `FocusOverviewView`, `HomeworkSettingsView`, `/dashboard` overview with `TimezoneSync`, `/dashboard/children/[childId]/homework` page and Server Actions, "Homework" link per child.

## Scenario verification
All scenarios are covered by the test-writer's tests (unchanged), run by `npm run check` (479 passed). `npm run build` passes.

## For the human
- Migration timestamp: `date -u` returned 20261117145224, which is older than the existing `20261118110000_offline_alerts.sql`. Supabase needs newer, so I used `20261118110100`.
- The overview page keeps a "View usage for <name>" link list below the cards (the old overview had it); `<li>` items inside the cards are only the trend items, as the tests require.
- The Server Actions and DB-dependent behaviour are not exercised by unit tests; verify on production after merge (previews share the production database).

## Docs to update
- `docs/architecture.md`: `children.homework_domains`, `/dashboard` focus overview, `?tz=` param on `/dashboard`, homework settings page.
