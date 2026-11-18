# Design

## Data

Table `public.child_category_limits`:

- `child_id uuid not null references public.children (id) on delete cascade`
- `category text not null` with a check for the 9 categories
- `minutes_per_day integer not null check (minutes_per_day between 5 and 1440)`
- primary key `(child_id, category)`

Details:

- RLS enabled; select, insert, update and delete policies use the same `child_id in (select id from public.children where family_id = public.current_family_id())` form as `block_rules`. Grants: `authenticated` select, insert, update, delete; `service_role` all.
- Trigger `child_category_limits_bump_rules_version` (after insert, update or delete, per row) executes the existing `public.bump_rules_version()`; the function is not re-created. It reads `old.child_id` / `new.child_id`, which this table has.
- This is parent configuration, not data collected from the child: ADR 0005 is unchanged and no ADR is needed. Rows live as long as the child (cascade); no extra retention job.
- The migration file name uses the UTC time at build time and must sort after the newest file on main (platform notes).

## Web

- `lib/daily-limits.ts` (client injected, like `block-rules.ts`):
  - `listDailyLimits(client, childId)` returns `{ ok: true, limits }` in `CATEGORIES` order, or `{ ok: false, error: "failed" }`.
  - `saveDailyLimits(client, childId, values)`, where `values` maps category to the raw input string. Every key must be a category and every non-empty value must match `^\d+$` and be 5 to 1440, otherwise `invalid_category` / `invalid_minutes` and nothing is written. Then one upsert (`onConflict: "child_id,category"`) of the set values and one delete of the cleared categories. Any store error or throw gives `failed`. The two calls are not atomic; after a failure the page reloads the real state.
- `components/daily-limits-card.tsx`: card using `ui.ts` classes only; one `<input type="number" min=5 max=1440 name="limit_<category>">` per category, prefilled; save button; error message.
- The rules page renders `DailyLimitsCard` below `BlockRulesView`; `actions.ts` adds `saveLimitsAction` (reads `limit_<category>` for each category, redirects with `?limitsError=<code>` on failure).

## API

- `RulesResponse` adds `limits: z.array({ category, minutesPerDay: int 5..1440 }).max(9).default([])` and `timezone: z.string().min(1).optional()`. The handler always sends both; the schema tolerates their absence so existing extension code and fixtures still parse. Old extensions strip unknown fields.
- `RulesStore.findChild` also returns `timezone` (from `families`); new `RulesStore.listLimits(childId)`. The version is still read first (`findChild`), then rules, overrides and limits. Any store failure keeps the existing fail-closed 500.
