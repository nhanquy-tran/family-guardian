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
- **Query** (`loadUsage` in `apps/web/src/lib/usage.ts`): one select on `usage_minutes` for the child's devices in `[startUtc, endUtc)` (today: one local day; week: 7 local days), paged in 1000-row ranges until a short page, because PostgREST caps responses. Child access is checked first by selecting the child with the session client; no row means `notFound()` and no usage query runs.
- **Failure**: a query error yields an error result; the page shows "Could not load usage. Try again." and no partial numbers. It never falls back to the service-role client.
- **Display**: plain HTML/CSS. Category colours are a fixed map in `apps/web`; every colour is paired with a text label. Durations are formatted `1 h 05 min` / `7 min`. The minute strip is a flex row of percentage-width segments over 24 h, so it scales to any width. One column below the `sm` breakpoint.

## Risks

- The seed category map is small, so many domains show as `other`; acceptable for MVP.
- A child with several devices can have about 10k rows per week; fine for 20 families.
