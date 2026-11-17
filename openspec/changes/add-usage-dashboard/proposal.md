# Proposal

Implements GitHub issue #12 ("Dashboard: today and week overview per child").

## Why

Heartbeats fill `usage_minutes`, but parents cannot see anything yet. They need a per-child view of today and of the week, readable on a phone.

## What Changes

- Pure aggregation functions in `packages/shared/src/usage-summary.ts` (day boundaries in a timezone, today overview, week view, minute timeline), using `categorize`.
- Page `/dashboard/usage/[childId]` with a Today / Week switch (`?view=week`), and a link per child from `/dashboard`:
  - **Today**: total active time, top 10 sites (time and share), time per category, minute strip coloured by category.
  - **Week**: last 7 days, stacked bar per day by category, top sites of the week.
- Timezone: the parent's browser timezone is passed as `?tz=<IANA name>`; a small client component adds it when missing. It is validated server-side and falls back to `UTC`. It is not stored or logged, so no new data and no ADR.
- Data is read with the parent's session client, so RLS limits it to the family.
- Layout is single-column and usable at 375 px.

## Capabilities

### New Capabilities
- `usage-dashboard`: aggregation of usage into today and week views and their display.

### Modified Capabilities
None.

## Dependencies

Must be merged first: #5 (categories), the database schema and heartbeat API (`usage_minutes` filled), parent Google sign-in, and child pairing (children exist). The focus score (#6) is not used here.

## Out of scope

- Showing the focus score, family category overrides, editing anything.
- Arbitrary date ranges, past-day navigation, CSV export.
- Storing the timezone in the database (a settings change later).
- Charting libraries: bars and strip are plain HTML/CSS.
- Multi-child comparison on one page.
