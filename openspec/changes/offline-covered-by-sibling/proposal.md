Depends on: #173
Touches: offline-alerts, digest-emails, supabase/migrations

# Offline alerts: a closed browser is not an incident while another browser of the child reports

## Why
With one device per browser (ADR 0024), a child who uses only Chrome makes the Firefox device silent for hours. `find_offline_devices` works per device, so this becomes a daily incident, banner and digest line: the noise `docs/platform-notes.md` (#18) warns against.

## What changes
- `find_offline_devices` skips a device while a sibling device (same child) reported after this device's `last_seen_at` and is itself still reporting (seen within 15 minutes of `p_now`).
- `resolve_offline_alerts` also resolves an open incident when a sibling device reported after `incident_last_seen_at`.
- The dashboard banner hides alerts with `resolved_at` set.
- A new migration replaces both functions (`create or replace`).

## Out of scope
- Grouping browsers into one "laptop" entity, new tables or columns, UI changes beyond the banner filter.
- Rewriting past incidents. An incident that was open and then resolved by a sibling stays in history with its `resolved_at`.
- Treating a device as covered by a device of another child.
