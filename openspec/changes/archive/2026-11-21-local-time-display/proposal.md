Depends on: none
Touches: web-ui, apps/web/src/components/offline-banner.tsx, apps/web/src/components/children-list.tsx, apps/web/src/lib/time/

# Parent dashboard shows times in the parent's timezone (#193)

## Why
The offline banner says "since 2026-11-21 10:40 UTC" and the pairing code says "Valid until 2026-11-21T10:55:00.000Z". Parents are mostly in Vietnam (UTC+7), so both read 7 hours off. The usage and overview pages already use the browser timezone.

## What changes
- `formatLocalTime(iso, timeZone)` in `apps/web/src/lib/time/local-time.ts`: `D Mon, HH:MM <zone>` (24-hour, `en-GB`, short zone name such as `GMT+7`), an invalid timezone read as `UTC`.
- `LocalTime` client component: a `<time dateTime=iso>` that formats in the browser timezone; the server render (before hydration, or without JavaScript) uses `UTC`, still labelled.
- The offline banner and the pairing-code expiry use `LocalTime`.

## Out of scope
- E-mails (digest, weekly report): they already use the family timezone.
- Relative times ("5 min ago") and allowed hours (child's timezone).
