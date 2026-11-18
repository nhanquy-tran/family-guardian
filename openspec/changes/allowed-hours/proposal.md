Depends on: #87
Touches: allowed-hours, block-enforcement, site-blocking, daily-limits, supabase/migrations

# Proposal

Implements GitHub issue #89 ("Allowed hours: no browsing outside a daily window").

## Why

Parents want to stop browsing at night. Outside a per-child daily window the extension must block every main-frame navigation, also offline and after a browser restart.

## What Changes

- Database: `children.allowed_start` and `children.allowed_end` (`HH:MM`, both set or both null), parent-editable under the existing RLS; changing them bumps the child's `rules_version`.
- `RulesResponse.allowedHours: { start, end } | null` (default `null`); `GET /api/device/rules` fills it from the child row. The window is read in the family `timezone` already delivered by #86.
- Rules page: an "Allowed hours" card (start, end, save, clear).
- Extension: one DNR redirect rule (all `http(s)` main-frame navigations) is switched on and off by an alarm at each window edge, recomputed on every normal alarm and on start-up. Windows may cross midnight.
- Block page: "Browsing is paused until HH:MM".
- No new permission. No new data sent to the server (ADR 0005 unchanged); no ADR needed (a schedule setting, not collected activity).

## Capabilities

- New: `allowed-hours`

## Out of scope

- Different hours per weekday, several windows per day, extra-time requests, warnings before the window ends.
- Recording blocked attempts during paused hours (there is no domain to record).
- Dashboard display of the window beyond the rules-page card.
- Enforcement changes for a `rejected` (401) device beyond keeping the local clock-driven switch running.
