## Purpose
The extension builds a second target for Firefox on Windows, with its own manifest, so a Firefox install pairs as another device of the same child, tracks and blocks like the Chromium builds and sends no extra data.

Test files:
- `apps/extension/lib/manifest.test.ts`: `buildManifest`, `buildFirefoxManifest`, `FIREFOX_MANIFEST_VERSION`, fixture `apps/extension/lib/fixtures/chromium-manifest.json` (the Chromium manifest generated before this change, with API origin `https://fg.example`).
- `apps/extension/lib/build-config.test.ts`: reads `apps/extension/package.json`.
- `apps/extension/lib/badge.test.ts`: badge updates with fake action objects.
- `apps/extension/lib/firefox-docs.test.ts`: reads `docs/platform-notes.md`.
- `packages/shared/src/extension.test.ts`: constants.
- `supabase/tests/firefox-device.test.ts` (PGlite harness): "child" has one Chrome device and one Firefox device, both created by the service role.

## ADDED Requirements

### Requirement: Firefox constants live in the shared package
`@fg/shared` SHALL export `FIREFOX_ADDON_ID` = `guardian@family-guardian.co` and `FIREFOX_UPDATE_URL` = `https://family-guardian.co/firefox/updates.json`, next to `EXTENSION_ID`.

#### Scenario: Constants
- **WHEN** `extension.test.ts` imports the constants from `@fg/shared`
- **THEN** `FIREFOX_ADDON_ID` is `guardian@family-guardian.co`, `FIREFOX_UPDATE_URL` is `https://family-guardian.co/firefox/updates.json` and `EXTENSION_ID` is unchanged

### Requirement: Firefox manifest identity and data declaration
`buildFirefoxManifest(apiOrigin)` SHALL return a `browser_specific_settings.gecko` block with `id` = `FIREFOX_ADDON_ID`, `update_url` = `FIREFOX_UPDATE_URL`, `strict_min_version` `140.0`, and `data_collection_permissions` with `required` exactly `["browsingActivity"]` and no `optional` entry (ADR 0005).

#### Scenario: Gecko identity
- **WHEN** `buildFirefoxManifest("https://fg.example")` is called (`manifest.test.ts`)
- **THEN** `browser_specific_settings.gecko.id` equals `FIREFOX_ADDON_ID`, `update_url` equals `FIREFOX_UPDATE_URL` and `strict_min_version` is `140.0`

#### Scenario: Data collection declares browsing activity only
- **WHEN** `buildFirefoxManifest("https://fg.example")` is called (`manifest.test.ts`)
- **THEN** `data_collection_permissions` equals `{ required: ["browsingActivity"] }`

### Requirement: Firefox asks for the same permissions as Chromium
The Firefox manifest SHALL request exactly the API permissions of `buildManifest` (`tabs`, `idle`, `storage`, `alarms`, `declarativeNetRequest`), host access to `<apiOrigin>/*` and `<all_urls>`, `incognito` `not_allowed`, and `blocked.html` as web accessible. No other permission SHALL be added.

#### Scenario: Same permission set
- **WHEN** the effective permissions of `buildFirefoxManifest("https://fg.example")` and `buildManifest("https://fg.example")` are compared (`manifest.test.ts`; effective = API permissions plus host patterns, wherever the manifest version puts them)
- **THEN** both sets are equal and contain `https://fg.example/*` and `<all_urls>`
- **AND** the Firefox manifest has `incognito` `not_allowed` and `blocked.html` web accessible

### Requirement: Firefox manifest version keeps site access
The Firefox build SHALL use `FIREFOX_MANIFEST_VERSION`, the manifest version in which a policy-installed add-on's access to all sites cannot be revoked by the user (MV2: host access is granted at install). `docs/platform-notes.md` SHALL record the finding and the reason.

#### Scenario: Manifest version is pinned
- **WHEN** `manifest.test.ts` reads `FIREFOX_MANIFEST_VERSION`
- **THEN** it is `2`
- **AND** `buildFirefoxManifest` lists `<all_urls>` as an install-time host permission, not as an optional one

### Requirement: Chromium manifest unchanged
`buildManifest` SHALL return exactly what it returned before the Firefox target existed.

#### Scenario: Chromium manifest equals the fixture
- **WHEN** `buildManifest("https://fg.example")` is called (`manifest.test.ts`)
- **THEN** it deep-equals `fixtures/chromium-manifest.json`
- **AND** it has no `browser_specific_settings` key

### Requirement: Firefox build and AMO zips
`apps/extension/package.json` SHALL define `build:firefox` (`wxt build -b firefox`) and `zip:firefox` (`wxt zip -b firefox`, producing the add-on zip and the sources zip for AMO). The existing `build` and `zip` scripts SHALL stay as they are.

#### Scenario: Scripts
- **WHEN** `build-config.test.ts` reads the `scripts` of `apps/extension/package.json`
- **THEN** `build:firefox` contains `-b firefox`, `zip:firefox` contains `wxt zip` and `-b firefox`, and `build` is `wxt build` and `zip` is `wxt zip`

### Requirement: Badge works with action or browserAction
The badge update SHALL use `action` when the browser has it and `browserAction` otherwise, and SHALL skip the update without throwing when neither exists.

#### Scenario: browserAction fallback
- **GIVEN** a fake browser object with only `browserAction` (`badge.test.ts`)
- **WHEN** the badge is set to text `"!"`
- **THEN** `browserAction.setBadgeText` was called with `{ text: "!" }`

#### Scenario: No action API
- **GIVEN** a fake browser object with neither `action` nor `browserAction` (`badge.test.ts`)
- **WHEN** the badge is set
- **THEN** no error is thrown

### Requirement: Several browsers of one child
Pairing a Firefox extension for a child SHALL add a device and SHALL keep the child's other devices. Totals, per-day usage and the other-devices usage SHALL include every device of the child, whatever its browser.

#### Scenario: Pairing Firefox keeps the Chrome device
- **GIVEN** a child with a Chrome device and an active pairing code (`firefox-device.test.ts`)
- **WHEN** `redeem_pairing_code(code, hash, 'firefox', 'Windows')` is called
- **THEN** the child has two devices, `chrome` and `firefox`, and the Chrome device row is unchanged

#### Scenario: Totals include both browsers
- **GIVEN** 60 seconds of `example.com` on the Chrome device and 120 seconds of `example.com` on the Firefox device in the same day (`firefox-device.test.ts`)
- **WHEN** `usage_total_seconds` (the function used by digests) and `usage_by_day` are called for the child
- **THEN** both report 180 seconds for the day

#### Scenario: Other-device usage across browsers
- **GIVEN** the same usage (`firefox-device.test.ts`)
- **WHEN** `device_other_usage` is called for the Chrome device and for the Firefox device
- **THEN** the Chrome device sees 120 seconds of `example.com` and the Firefox device sees 60 seconds

### Requirement: Firefox documented
`docs/platform-notes.md` SHALL have a Firefox section with the manifest-version finding and reason, and a manual smoke checklist covering pairing, tracking, idle, heartbeat, offline queue, blocking with the block page, category limits, allowed hours and the badge.

#### Scenario: Notes section exists
- **WHEN** `firefox-docs.test.ts` reads `docs/platform-notes.md`
- **THEN** it has a `## Firefox` heading containing `manifest` and `smoke`, and each of `pairing`, `idle`, `offline`, `block page`, `limit`, `allowed hours` and `badge` appears in that section
