# Design

## Context

On main: `children.homework_categories text[]` (checked against the 9 categories, parent insert/update granted by column in `20261117100000_heartbeat.sql`), `computeFocusScore(entries, homeworkDomains)`, `categorize`, `normalizeBlockDomain` (`apps/web/src/lib/block-rules.ts`), RLS per family on `children`, `devices`, `usage_minutes`. From #12 (must be merged): `resolveTimezone`, `dayRangeUtc`, `localDay`, `TimezoneSync`. The heartbeat migration revoked table-level insert/update on `children`, so a new editable column needs its own grant.

## Decisions

1. **Migration `supabase/migrations/<build-time timestamp>_homework_settings.sql`** (named at build time, later than all existing ones):
   - `alter table children add column homework_domains text[] not null default '{}'` with a check: at most 50 entries, and every entry matches `^[a-z0-9-]+(\.[a-z0-9-]+)+$` and is at most 253 chars.
   - `grant insert (homework_domains), update (homework_domains) on public.children to authenticated` (select is already table-wide).
   - `alter column homework_categories set default '{education}'`, and `update children set homework_categories = '{education}' where homework_categories = '{}'`. Safe because no UI wrote this column before.
   - No change to `rules_version` triggers: homework settings are not sent to the extension.
2. **`homeworkDomainsFor(usageDomains, { categories, extraDomains })`** (shared): returns the sorted, distinct usage domains `d` where `categorize(d)` is in `categories`, or `d === x` or `d` ends with `"." + x` for some extra domain `x`. Only domains seen in usage are returned, which is all `computeFocusScore` needs. Family overrides are out of scope (seed map only).
3. **Settings module** `apps/web/src/lib/homework.ts` (parent's Supabase client, RLS does the family check): `getHomeworkSettings`, `saveHomeworkCategories`, `addHomeworkDomain`, `removeHomeworkDomain`. Result `{ ok: true } | { ok: false; error: "invalid_category" | "invalid_domain" | "duplicate" | "too_many" | "not_found" | "failed" }`. Domains are normalized with `normalizeBlockDomain` and stored as typed host. Add and remove read the child's array, change it and write it back; the update uses `.select("id")` and zero rows means `not_found` (another family's child is hidden by RLS). Two parents editing at once could lose one edit; accepted for MVP. Removing a domain is a reversible setting, so it has no confirmation step.
4. **Loader** `apps/web/src/lib/focus-overview.ts`: `loadFocusOverview(client, tz, now)`. Lists children with settings (a list error is distinct from "no children"). Per child: select its devices, then page `usage_minutes` for the 7 local days (`dayRangeUtc` of the first and last day) with `.in("device_id", ids)`, ordered by `(minute_utc, domain, device_id)`, explicit `.range()` pages of 1000 until a short page (PostgREST cap, see platform notes), at most 30 pages (30,000 rows; more is an error, never a silent cut). Rows are grouped by `localDay`, then `homeworkDomainsFor` and `computeFocusScore` run per day. Result per child: `{ today: FocusScore & { otherSeconds }, trend: { day, score }[7] }` or `{ error: true }`. Any failed call for a child discards that child's partial rows; other children still render. Never uses the service role. Aggregating in TypeScript is acceptable here because the formula needs minute order and domains; the 7-day read is paged and capped as above.
5. **Display**: server components with plain HTML/CSS (no chart library). The trend is 7 bars with the score as text under each; days without data show "no data", never 0. A child with no homework categories and no extra domains shows "Choose what counts as homework" linking to settings instead of a score. The explanation is a static paragraph: score = share of active time on homework sites, minus up to 20 points for frequent switching between homework and other sites; days without activity have no score. Single column below `sm`.
6. **Timezone**: same `?tz=` + `TimezoneSync` mechanism as #12, on `/dashboard`.

## Risks

- The seed category map is small, so some real homework sites count as "other"; extra domains are the escape hatch.
- Several devices report the same minute separately, so seconds in a minute can exceed 60; the focus function only uses ratios, acceptable.
