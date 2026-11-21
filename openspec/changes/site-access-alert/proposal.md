Depends on: #173
Touches: device-heartbeat, heartbeat-sender, offline-alerts, digest-emails, database-schema, supabase/migrations

# Alert the parent when the extension loses site access

## Why
If the child revokes the extension's access to all websites (for example in Firefox's `about:addons`), blocking silently stops working. ADR 0024 decides that the extension reports this as one yes/no heartbeat value (an amendment to ADR 0005) and that the parent is alerted. This change delivers the check, the contract, the stored value, the dashboard banner and the digest line. It works for Chromium builds with the same check.

## What changes
- **Extension**: once per minute alarm the controller asks the browser whether the `<all_urls>` host permission is still held and sends the answer as `siteAccess` (boolean) in the heartbeat, including the keep-alive heartbeat of a rejected device. If the check itself fails, `siteAccess` is omitted.
- **Contract**: `HeartbeatRequest` and `HeartbeatEnvelope` get an optional `siteAccess` boolean. A missing value (older extension) means "has access".
- **Server**: the heartbeat stores the latest value per device in `devices.site_access` (default true). A trigger records an incident row in a new table `site_access_incidents` when it flips to false and resolves it when it flips back to true.
- **Dashboard**: the existing banner component also shows "Blocking is off on <device>: site access was turned off" for each device whose `site_access` is false; it disappears on the next heartbeat after access returns.
- **Digest**: each child's section lists site-access incidents of the period like offline incidents ("Site access off").
- **ADR 0025** (proposed): the incident table, its retention (90 days) and that it holds no browsing data.

## Out of scope
- Re-requesting the permission or any other action on the child's browser.
- E-mail per incident (the digest is the only e-mail, ADR 0016).
- Privacy policy page text for the new yes/no value (separate docs issue; listed in NOTES.md).
- Reporting any other permission or state.
- Detecting a disabled or removed extension (offline alerts already cover it).
