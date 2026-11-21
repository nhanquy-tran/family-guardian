## Purpose
The extension builds a second target for Firefox on Windows, with its own manifest, so a Firefox install pairs as another device of the same child, tracks and blocks like the Chromium builds and sends no extra data.

Test files:
- `apps/extension/lib/manifest.test.ts`: `buildManifest`, `buildFirefoxManifest`, `FIREFOX_MANIFEST_VERSION`, fixture `apps/extension/lib/fixtures/chromium-manifest.json` (the Chromium manifest generated before this change, with API origin `https://fg.example`).
- `apps/extension/lib/build-config.test.ts`: reads the root `package.json`, `apps/extension/package.json` and the exported config of `apps/extension/wxt.config.ts`.
- `apps/extension/lib/browser-info.test.ts`: `resolveBadgeApi`.
- `apps/extension/lib/badge.test.ts`: badge updates with fake action objects.
- `apps/extension/lib/firefox-docs.test.ts`: reads `docs/platform-notes.md`.
- `packages/shared/src/extension.test.ts`: constants.
- `supabase/tests/firefox-device.test.ts` (PGlite harness): reuses the fixtures and helpers of `supabase/tests/cross-browser-usage.test.ts`; "child" has one Chrome device and one Firefox device, both created by the service role, and every totals scenario includes the Firefox device.

## ADDED Requirements

### Requirement: Firefox manifest identity and data declaration
`@fg/shared` SHALL export `FIREFOX_ADDON_ID` = `guardian@family-guardian.co` and `FIREFOX_UPDATE_URL` = `https://family-guardian.co/firefox/updates.json`, next to `EXTENSION_ID`. `buildFirefoxManifest(apiOrigin)` SHALL return a `browser_specific_settings.gecko` block with `id` = `FIREFOX_ADDON_ID`, `update_url` = `FIREFOX_UPDATE_URL`, `strict_min_version` `140.0`, and `data_collection_permissions` with `required` exactly `["browsingActivity"]` and no `optional` entry (ADR 0005).

#### Scenario: Gecko identity and data declaration
- **WHEN** `buildFirefoxManifest("https://fg.example")` is called (`manifest.test.ts`)
- **THEN** `browser_specific_settings.gecko.id` equals `FIREFOX_ADDON_ID`, `update_url` equals `FIREFOX_UPDATE_URL` and `strict_min_version` is `140.0`
- **AND** `data_collection_permissions` equals `{ required: ["browsingActivity"] }`
- **AND** `extension.test.ts` finds `FIREFOX_ADDON_ID` = `guardian@family-guardian.co`, `FIREFOX_UPDATE_URL` = `https://family-guardian.co/firefox/updates.json` and `EXTENSION_ID` unchanged in `@fg/shared`

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
`buildManifest` SHALL return exactly what it returned before the Firefox target existed. `wxt.config.ts` SHALL export the per-target manifest function `manifestFor({ browser, apiOrigin })`; for any browser other than `firefox` it SHALL return exactly the `buildManifest` output with the same `name` and `description` as before, and no `persistent` key.

#### Scenario: Chromium manifest equals the fixture
- **WHEN** `buildManifest("https://fg.example")` and `manifestFor({ browser: "chrome", apiOrigin: "https://fg.example" })` are called (`manifest.test.ts`, `build-config.test.ts`)
- **THEN** both deep-equal `fixtures/chromium-manifest.json`, name and description included
- **AND** neither has a `browser_specific_settings` key, and neither the manifest nor its `background` has a `persistent` key

### Requirement: Firefox target in the WXT config
For `browser: "firefox"`, `manifestFor` SHALL return `buildFirefoxManifest` output and the config SHALL set `manifestVersion` from `FIREFOX_MANIFEST_VERSION`. The background entry SHALL set `persistent: false` in `defineBackground` for Firefox MV2 (a non-persistent event page).

#### Scenario: Firefox target
- **WHEN** `manifestFor({ browser: "firefox", apiOrigin: "https://fg.example" })`, the config's Firefox `manifestVersion` and the options exported by the background entry are read (`build-config.test.ts`)
- **THEN** the manifest has `browser_specific_settings.gecko.id` equal to `FIREFOX_ADDON_ID`, `manifestVersion` equals `FIREFOX_MANIFEST_VERSION` and background `persistent` is `false`

### Requirement: Firefox build scripts
`apps/extension/package.json` SHALL define `build:firefox` (`wxt build -b firefox`) and `zip:firefox` (`wxt zip -b firefox`). The existing `build` and `zip` scripts SHALL stay as they are. The root `package.json` `build` script SHALL also run `npm run build:firefox -w extension`, so CI and the build gate build Firefox.

#### Scenario: Scripts
- **WHEN** `build-config.test.ts` reads the `scripts` of `apps/extension/package.json` and of the root `package.json`
- **THEN** `build:firefox` contains `-b firefox`, `zip:firefox` contains `wxt zip` and `-b firefox`, and `build` is `wxt build` and `zip` is `wxt zip`
- **AND** the root `build` contains `npm run build:firefox -w extension` after `npm run build -w extension`

### Requirement: AMO sources zip is rebuildable
The WXT `zip` config SHALL set `sourcesRoot` to the repository root, include `apps/extension`, `packages/shared`, the root `package.json` and the lockfile, and exclude `.env*`, `node_modules` and `apps/web`, so an AMO reviewer can rebuild the add-on.

#### Scenario: Sources zip config
- **WHEN** `build-config.test.ts` reads the `zip` section of the exported WXT config
- **THEN** `sourcesRoot` is the repository root, the include list covers `apps/extension`, `packages/shared`, `package.json` and `package-lock.json`, and the exclude list covers `.env*`, `node_modules` and `apps/web`

### Requirement: Badge works with action or browserAction
`resolveBadgeApi(browser)` in `lib/browser-info.ts` SHALL return `browser.action ?? browser.browserAction ?? undefined`. The badge update SHALL use that result and SHALL skip the update without throwing when it is `undefined`.

#### Scenario: Badge API resolution
- **WHEN** `resolveBadgeApi` is called with an object having both `action` and `browserAction`, one having only `browserAction`, and one having neither (`browser-info.test.ts`)
- **THEN** it returns the `action`, the `browserAction` and `undefined`
- **AND** setting the badge text `"!"` through the `browserAction`-only object calls `browserAction.setBadgeText` with `{ text: "!" }`, and setting it through the neither object throws no error (`badge.test.ts`)

### Requirement: Several browsers of one child
Pairing a Firefox extension for a child SHALL add a device and SHALL keep the child's other devices. Totals, per-day usage and the other-devices usage SHALL include every device of the child, whatever its browser.

#### Scenario: Pairing Firefox keeps the Chrome device
- **GIVEN** a child with a Chrome device and an active pairing code (`firefox-device.test.ts`)
- **WHEN** `redeem_pairing_code(code, hash, 'firefox', 'Windows')` is called
- **THEN** the child has two devices, `chrome` and `firefox`, and the Chrome device row is unchanged

#### Scenario: Totals and other-device usage include both browsers
- **GIVEN** 60 seconds of `example.com` on the Chrome device and 120 seconds of `example.com` on the Firefox device in the same day (`firefox-device.test.ts`)
- **WHEN** `usage_total_seconds` (the function used by digests), `usage_by_day` and `device_other_usage` are called
- **THEN** the first two report 180 seconds for the child's day
- **AND** `device_other_usage` for the Chrome device shows 120 seconds of `example.com` and for the Firefox device 60 seconds

### Requirement: Firefox documented
`docs/platform-notes.md` SHALL have a Firefox section with the manifest-version finding and reason, and a manual smoke checklist covering pairing, tracking, idle, heartbeat, offline queue, a real block test (a blocked domain redirects to `blocked.html`), category limits that block, allowed hours that block, and the badge.

#### Scenario: Notes section exists
- **WHEN** `firefox-docs.test.ts` reads `docs/platform-notes.md`
- **THEN** it has a `## Firefox` heading containing `manifest` and `smoke`, and each of `pairing`, `idle`, `offline`, `block page`, `blocked.html`, `limit`, `allowed hours` and `badge` appears in that section
