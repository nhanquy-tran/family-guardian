## Context

`usage_minutes(device_id, minute_utc, domain, seconds)` is readable by parents through RLS. Categories come from `categorize` in `@fg/shared` (seed map only; overrides are out of scope).

## Decisions

- **Pure core in shared**, so it is unit-tested without a browser:
  - `dayRangeUtc(day: "YYYY-MM-DD", tz)` returns `{ startUtc, endUtc }` using `Intl.DateTimeFormat` (handles DST days of 23/25 h).
  - `localDay(minuteUtc, tz)` returns the `YYYY-MM-DD` of an instant in `tz`.
  - `summarizeDay(entries)` returns `{ totalSeconds, topSites: {domain, seconds, share}[] (max 10), byCategory: Record<Category, number> }`. Share is rounded to whole percent.
  - `summarizeWeek(entries, tz, lastDay)` returns 7 days (oldest first, `lastDay` = today), each with `byCategory` and `totalSeconds`, plus week `topSites` (max 10).
  - `buildTimeline(entries, tz, day)` returns one slot per minute that has data: `{ minuteOfDay, category }`, category being the one with most seconds in that minute (ties: first in `CATEGORIES` order).
  - `resolveTimezone(value)` validates an IANA name via `new Intl.DateTimeFormat("en", { timeZone })`; invalid or missing gives `UTC`.
- **Timezone** comes from the `tz` query param. A tiny client component `TimezoneSync` calls `router.replace` with the browser zone when `tz` is absent. No cookie, no DB column, nothing logged.
- **Aggregate in the database, never in the client.** PostgREST returns at most 1000 rows per request, and a week of `usage_minutes` is far above that, so raw rows are never read by the page. A new migration `supabase/migrations/20261118000000_usage_functions.sql` (file plan; never edit an applied migration) adds three functions, all `language sql stable`, `security invoker` (RLS on `usage_minutes`, `devices`, `children` still applies, so another family's child returns no rows), `set search_path = ''`, fully schema-qualified, `execute` granted to `authenticated` only and revoked from `public`/`anon`:
  - `usage_by_day(child_id uuid, tz text, days int)` returns `(day date, domain text, seconds bigint)`: one row per local day and domain over the last `days` local days (1 to 31, else raises). At most `days x distinct domains` rows; `loadUsage` still reads with explicit `.range()` pages ordered by `(day, domain)` until a short page, so even a very wide week cannot be cut off.
  - `usage_timeline(child_id uuid, tz text, day date)` returns `(minute_of_day int, domains text[], seconds int[])`: one row per minute with data (at most 1440, so also read in explicit `.range()` pages ordered by `minute_of_day`). `buildTimeline` picks the dominant category from the arrays.
  - `tz` is validated in SQL against `pg_timezone_names`; an unknown name raises `invalid_timezone` (never silently UTC at this layer). The page already falls back to `UTC` through `resolveTimezone` before calling.
  - Local days use `(minute_utc at time zone tz)::date`; the range filter uses the UTC bounds of the first and last local day so the index on the primary key is used.
- **Pure core stays in shared** and now works on the aggregated rows: `summarizeDay`, `summarizeWeek` and `buildTimeline` take `(day, domain, seconds)` rows or `(minute, domains[], seconds[])` rows instead of raw minutes. `dayRangeUtc`/`localDay` remain for tests and the page's date labels.
- **Loading** (`loadUsage` in `apps/web/src/lib/usage.ts`): first selects the child with the session client; no row means `notFound()` and no function is called. Then calls the RPC with the session client in explicit ranges. Any error on any call (child lookup, RPC page, timeline page) yields one error result for the whole page.
- **Failure**: every data call has an error path. The page shows "Could not load usage. Try again." and no numbers: if any page of a multi-page read fails, all already-read pages are discarded, so partial totals are never shown as complete. It never falls back to the service-role client. The child lookup error is distinct from "not found" (error state, not 404).
- **"Blocked today" card (placeholder, from #14)**: the usage page reserves a slot for a "Blocked today" card, shown only when `block_events` exist for the child that day. It is not part of this change; it becomes a later change that adds its own function and scenarios. Nothing is rendered now.
- **Display**: plain HTML/CSS. Category colours are a fixed map in `apps/web`; every colour is paired with a text label. Durations are formatted `1 h 05 min` / `7 min`. The minute strip is a flex row of percentage-width segments over 24 h, so it scales to any width. One column below the `sm` breakpoint.

## Risks

- The seed category map is small, so many domains show as `other`; acceptable for MVP.
- A child with several devices can have about 10k raw rows per week; they are aggregated in SQL, so the response stays small. Function cost is one indexed range scan per call; fine for 20 families.
- Functions run as the caller, so a missing RLS policy would show as empty data, not an error; the PGlite test covers the cross-family case.
