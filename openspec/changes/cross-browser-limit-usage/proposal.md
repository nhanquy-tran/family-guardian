Depends on: #143
Touches: limit-enforcement, limit-badge, device-heartbeat, site-blocking, heartbeat-sender, packages/shared/src/index.ts, supabase/migrations

## Why
Daily category limits and the "minutes left" badge count usage per browser (`limitUsage`). A child paired in Chrome and Edge gets each limit once per browser. The server already stores usage per device. Owner decision (#140, option a): the server returns the other devices' usage and the extension adds it to its own.

## What changes
- A SQL function sums today's seconds per domain of the child's *other* devices in the family timezone; the web layer maps domains to categories (seed plus family overrides) and returns **category seconds only**.
- Both responses may carry an optional `otherUsage: { day, seconds }`, validated apart from the base response schemas so a bad value never fails a heartbeat or a rules sync.
- The extension stores the last valid `otherUsage` (`FlushResult` `ok` carries it), adds it to local usage for blocking and for the badge, and keeps using the last value offline. Re-pairing removes it (MODIFIES "Re-pairing resets rule state", which #146 / #143 also changes, so #146 merges first).
- `docs/architecture.md`: the `children` line also lists `child_category_limits` among the tables that bump `rules_version` (see NOTES).

## Out of scope
- Domain-level cross-device data, per-device limits, changing the 60 s heartbeat, a rules-version bump on usage.
- Usage of the same device lost by a reinstall.
