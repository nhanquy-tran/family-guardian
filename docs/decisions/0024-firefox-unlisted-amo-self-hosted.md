# 0024. Firefox: unlisted AMO-signed add-on, self-hosted, force-installed by policy

Date: 2026-11-21. Status: accepted (owner approved 2026-11-21).

## Context
Children use Firefox as well as Chrome (for example for its ad blockers). An unmonitored browser on the laptop defeats the product. Firefox installs only Mozilla-signed add-ons, and new add-ons must declare their data collection in the manifest (`browser_specific_settings.gecko.data_collection_permissions`). In Manifest V3 a user can revoke an add-on's site access in `about:addons`, which would silently stop blocking redirects. Firefox reads Windows policies from `HKLM\SOFTWARE\Policies\Mozilla\Firefox` without domain join.

## Decision
- **Same extension, second target.** `apps/extension` builds for Chrome (unchanged) and for Firefox with WXT. One code base, same behaviour, same permissions.
- **Fixed add-on ID** `guardian@family-guardian.co`, kept in `@fg/shared` next to the Chrome extension ID.
- **Signed as an unlisted add-on on addons.mozilla.org (AMO), hosted by us.** The signed `.xpi` and a Firefox update manifest are served from `https://family-guardian.co/firefox/` (`latest.xpi`, `updates.json`); the manifest's `update_url` points there. The owner signs each release on AMO by hand; signing in CI needs AMO API keys (new secrets) and is a later, separate decision.
- **Manifest version chosen for tamper resistance.** The Firefox build uses the manifest version in which a policy-installed add-on's access to all sites cannot be revoked by the user, verified on a real Firefox and recorded in `docs/platform-notes.md`. Independently, the extension reports lost site access so the parent is alerted: one yes/no value in the heartbeat (an amendment to ADR 0005's field list, approved with this ADR; no page data).
- **Data declaration follows ADR 0005**, nothing more: browsing activity (registrable domain and seconds) as required. If AMO treats browser, OS and extension version as `technicalAndInteraction` (which cannot be required), the first submission settles how they are declared; any change to what is sent needs the owner.
- **Install policy.** The setup `.reg` adds, next to the Chromium browsers: `ExtensionSettings` with `installation_mode: force_installed` and `install_url` = our `latest.xpi` (prevents removal, applies to every profile), and `DisablePrivateBrowsing=1`. The remove `.reg` deletes exactly these values. Existing Chrome, Edge and Brave entries are unchanged, so running the new setup file on a laptop that already has the Chrome policy is safe.
- **One child, many browsers.** Each browser pairs as its own device of the same child. Dashboard totals, focus score, category limits and digests already combine all of a child's devices; this stays true for Firefox. The browser value `firefox` is added to the contract and the database check.

## Consequences
- Every extension release now has two artefacts: the Chrome Web Store zip and the AMO-signed `.xpi` (owner step).
- The privacy policy page and `docs/chrome-web-store.md`-style justifications get a Firefox section.
- Other browsers (Opera, portable browsers) remain unmonitored; out of scope here.

## Risks
- AMO review of unlisted add-ons is automated but can flag permissions (`<all_urls>`, `declarativeNetRequest`). Mitigation: the same minimal permission set as Chrome, a clear data declaration and the privacy policy link.
- If no manifest version keeps site access locked under policy, the lost-access alert is the fallback.
