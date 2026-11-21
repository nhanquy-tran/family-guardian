Depends on: none
Touches: firefox-extension, database-schema, device-pairing, device-heartbeat, device-management, heartbeat-sender, activity-tracking, supabase/migrations

# Extension runs on Firefox for Windows

## Why
The child also uses Firefox, which is not monitored today. ADR 0024 (accepted) decides how: the same extension code base, a second WXT target, an unlisted AMO-signed add-on with a fixed ID. This change delivers the extension side: the Firefox build, manifest, browser detection, the `firefox` browser value end to end, and proof that several browsers of one child add up without double counting.

## What changes
- A Firefox build next to the Chromium one (`wxt build -b firefox`) and `zip:firefox` (add-on zip plus sources zip for AMO upload). The Chromium manifest and build stay byte-for-byte as they are today.
- Firefox manifest: gecko ID and update URL (constants in `@fg/shared`), `strict_min_version` that supports `data_collection_permissions`, data declaration (browsing activity, required, nothing else), the same permissions as Chromium, `incognito: not_allowed`, and the manifest version in which policy-installed access to all sites cannot be revoked (finding recorded in `docs/platform-notes.md`).
- `detectBrowser` returns `firefox`; the `browser` enum in the zod contracts gains `firefox`; a migration adds `firefox` to the `devices.browser` check; the devices page shows "Firefox".
- The badge works with `browser.action` or, where Firefox has only `browserAction`, with that.
- One child, several browsers: tested with one Chrome and one Firefox device of a child (pairing keeps the Chrome device; totals, other-device usage and digest totals include both).
- Focus handoff test: time is credited only while a browser window has focus, so switching browsers never counts a second twice.
- `docs/platform-notes.md` gets a Firefox section: the manifest-version finding and a manual smoke checklist.

## Out of scope
- The Windows setup/remove `.reg` files and the install page for Firefox (ExtensionSettings, `DisablePrivateBrowsing`): a separate issue.
- Serving `latest.xpi` and `updates.json` from `family-guardian.co/firefox/`, AMO signing and its secrets (owner step, ADR 0024).
- The lost-site-access yes/no heartbeat value from ADR 0024: it sends new data, and this issue sends none (ADR 0005 unchanged here).
- Privacy policy and store-justification text for Firefox.
- Firefox on Android, other browsers (Opera, portable browsers).
