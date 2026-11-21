## Context
ADR 0024 fixes the approach (second WXT target, fixed ID, unlisted AMO add-on, one device per browser). This design covers only what a builder could get wrong.

## Decisions
- **Manifest version.** Firefox MV3 treats host permissions as optional, so a user can revoke "access to all sites" in `about:addons` and the DNR redirects stop. Firefox MV2 grants host permissions at install, and they cannot be revoked. The Firefox build therefore targets **MV2** (one constant, `FIREFOX_MANIFEST_VERSION = 2` in `apps/extension/lib/manifest.ts`, pinned by a test). The developer confirms this against Mozilla's documentation and records the finding and reason in `docs/platform-notes.md`; the owner confirms it on a real Firefox with the smoke checklist (ADR 0024 requires "verified on a real Firefox"). If the finding is that MV3 is the right one, only that constant and the action fallback change.
- **MV2 consequences.** WXT converts `host_permissions` into `permissions` and `web_accessible_resources` into a string list for MV2; the tests compare the effective permission set, not the key layout. `browser.action` does not exist in MV2: badge code takes an `action` object resolved by `browser.action ?? browser.browserAction`, so `controller.ts` keeps one code path. DNR (`declarativeNetRequest`, `redirect.extensionPath`, `requestDomains`) is available to Firefox MV2 add-ons with host permission.
- **Background.** The background entry is a non-persistent event page on Firefox. Listeners stay registered synchronously and state stays in `storage.local` (same rule as the service worker).
- **Manifest builder.** `buildManifest` (Chromium) is not edited. A new `buildFirefoxManifest(apiOrigin)` reuses its permission lists and adds the `browser_specific_settings.gecko` block. `wxt.config.ts` picks one per target (`browser === "firefox"`). A fixture of today's generated Chromium manifest is committed so the "unchanged" test compares against a fixed file, not against the builder itself.
- **Gecko block.** `id` = `FIREFOX_ADDON_ID`, `update_url` = `FIREFOX_UPDATE_URL`, `strict_min_version` = `"140.0"` (first desktop release with `data_collection_permissions`), `data_collection_permissions: { required: ["browsingActivity"] }` and no `optional`. If AMO later requires a different declaration for browser/OS/version, the owner decides (ADR 0024).
- **Browser value.** `BrowserName` gains `firefox`. Detection order: `isBrave`, Edge, Opera (`OPR/`), Chrome, then Firefox (`Firefox/` in the user agent with no Chromium brand), else `other`. The allowed-values list in `background.ts` moves into `parseBrowserName` in `browser-info.ts` so it is unit-tested and cannot drift from the enum.
- **Migration.** One new file, `supabase/migrations/<timestamp>_firefox_browser.sql`, named with the current UTC time at build time (newer than `20261119120000`). It drops and re-adds the `devices.browser` check with `firefox` added. No `update`, `delete` or grant change, so existing rows and column grants stay as they are.
- **One child, many browsers.** No schema or function change is needed: `redeem_pairing_code` inserts a device and deletes only the used code; `usage_total_seconds`, `usage_by_day` and `device_other_usage` already work per child. This change adds tests with a Chrome and a Firefox device to keep it true.
- **Focus handoff.** Each browser runs its own tracker; double counting is prevented by crediting only while a window has focus (`windows.onFocusChanged`, `WINDOW_ID_NONE` when another app has focus). The test drives two independent tracker states with interleaved focus events and checks the credited seconds never exceed wall time. Residual risk: a browser that does not report loss of focus on Windows; covered by the smoke checklist.

## Data model
No new table or column. `devices.browser` check gains `firefox`; `devices` stays owned by the service role for writes and parent-readable through the existing column grants (`browser` is already granted). RLS unchanged. Retention unchanged. Existing rows are not touched.

## Contracts
`PairRequest`, `HeartbeatRequest` and `HeartbeatEnvelope` accept `firefox` in `browser` (shared zod enum, one shared constant list used by all three). Already installed Chrome, Edge and Brave extensions keep sending their old values and are unaffected. The web side must accept `firefox` before a Firefox build can pair: the web deploy and migration (merge) precede any AMO release, which is an owner step. Adding the enum value is backward compatible for the new Firefox extension and for old extensions. No new request field, no new endpoint.

## Failure modes
- Pairing and heartbeat failures behave as on Chromium (401 keeps data, 413 splits, queue kept on failure); nothing new is called.
- A migration failure leaves the old check; a Firefox pair would then be rejected by the database and the pair route answers its normal failure, so nothing is stored. The route fails closed.
- An unknown browser string in the extension store is sent as `other` (existing rule).
- If `browser.action` and `browser.browserAction` are both missing the badge update is skipped without throwing; blocking and tracking continue.

## Alternatives
- Build Firefox as MV3 like Chromium: simpler, but the user can revoke site access, which silently disables blocking; the ADR chose tamper resistance.
- A separate Firefox extension project: duplicates tracker, queue and blocking; rejected by ADR 0024.
- A `browser` column without a check: weaker data integrity than the existing constraint.

## ADR impact
Follows ADR 0005 (nothing new sent; the lost-access flag is out of scope), ADR 0009 and ADR 0024 (the decision implemented here). No new or changed ADR. The order against other open changes does not matter: none is open (`openspec/changes/` holds only this change).
