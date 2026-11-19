Depends on: none
Touches: child-management, allowed-hours, daily-limits

# Report a write that changed no row

## Why
Renaming or deleting a child, saving allowed hours and clearing daily limits report success when RLS matched no row, for example when the child id belongs to another family or the child was deleted meanwhile. No data is exposed or changed, but the parent sees a false "saved". Found while testing the server actions (#161). Issue #169.

## What changes
- `renameChild` and `deleteChild` ask for the changed row ids and return `{ ok: false, error: "Child not found" }` when there are none.
- `saveAllowedHours` does the same and returns `{ ok: false, error: "not_found" }`.
- `saveDailyLimits` with only cleared values first reads the child (RLS-scoped) and returns `{ ok: false, error: "not_found" }` when it is not visible. A delete that matches no limit is still a success, because clearing an unset limit is normal.
- The allowed-hours and daily-limits cards show "This child was not found. Reload the page and try again." for `not_found`.

## Out of scope
- `removeBlockRule` already returns `not_found`; no change.
- No schema, RLS or API change.
