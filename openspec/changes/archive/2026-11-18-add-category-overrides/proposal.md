Depends on: none
Touches: category-overrides, dashboard-shell, usage-dashboard

## Why

Parents see wrong categories ("this domain is education, not games"). Family rows in `domain_categories` already win over global rows in the rules API, and the database already bumps `rules_version` for every child of the family on any family row change. The parent UI is missing, and the usage page ignores overrides today: `summarizeDay`, `summarizeWeek` and `buildTimeline` call `categorize(domain)` without an overrides map (#91).

## What changes

- New page `/dashboard/categories`: lists the family's overrides (domain, category, remove) and a form to add or change one. The domain is normalised with `normalizeBlockDomain`; the category comes from the fixed list of 9.
- New nav item "Categories" after "Children" in the dashboard nav.
- Each top site on the usage page gets a "Change category" link to `/dashboard/categories?domain=<domain>`, which pre-fills the form.
- Usage categories use overrides: `summarizeDay`, `summarizeWeek` and `buildTimeline` accept an optional overrides map, and the usage page loads `domain_categories` (session client) and passes it. A load failure shows the usage error.
- New module `apps/web/src/lib/category-overrides.ts` (list, save, remove) using the parent's session client, so RLS applies.
- No migration: the table, RLS policies and the `rules_version` trigger exist (`20261117000000_initial_schema.sql`, `20261117100000_heartbeat.sql`). New database tests only pin them for this feature.

## Out of scope

- Editing global rows; per-child overrides; bulk import; category suggestions.
- Changing how `categorize` or the rules API read overrides. The focus score uses homework domains, not categories, so overrides do not affect it.
- Sending the override map to devices: done by #87 (limit enforcement), which adds `categoryOverrides` to `RulesResponse`. Devices get only the expanded blocked domains today.
- New stored data: overrides are domains and categories the parent typed (family settings, deleted with the family by cascade); no ADR needed.
