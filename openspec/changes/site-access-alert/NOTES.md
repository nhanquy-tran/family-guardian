# Docs to update
- `docs/architecture.md`: heartbeat carries `siteAccess`; `site_access_incidents` table and trigger.
- `docs/platform-notes.md`: `permissions.contains` for `<all_urls>` on Chromium; on Firefox MV2 (#173) host permissions cannot be revoked, so the check is a safety net there. Record the owner-check result below.
- Privacy policy page and store justifications: one sentence about the yes/no site-access value (ADR 0024).
- `docs/decisions/0025-site-access-incidents.md`: owner to accept (status is proposed).

# Owner steps
- Real-browser check on policy-installed Chrome and Firefox: can the user withhold site access at all (Chrome "on click", Firefox permission revoke), and does a heartbeat still arrive with `<all_urls>` withheld while the API origin is kept? Record the result in platform notes.
- Manual check of this change: on a Chromium browser where site access can be changed (confirm force-installed extensions allow it), withhold site access and expect the banner within two minutes. Not on Firefox MV2.
- If withholding is possible and heartbeats stop, the follow-up is CORS headers on the device routes for the extension origins, so heartbeats no longer need the API host permission. Not in scope here.
