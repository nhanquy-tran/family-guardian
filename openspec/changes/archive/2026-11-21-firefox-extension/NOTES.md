# Notes

## Docs to update
- `docs/platform-notes.md`: new "Firefox" section (manifest version finding and reason, smoke checklist with a real block test), written by the change itself.
- `docs/architecture.md`: mention the Firefox build target and the `firefox` browser value.
- `apps/extension/CLAUDE.md`: "Chrome, Edge and Brave" becomes "Chrome, Edge, Brave and Firefox"; Firefox build and zip commands.
- `docs/decisions/README.md`: no change (ADR 0024 already indexed).

## Expected test edits
`firefox` was the invalid browser in existing tests; it is valid now, so `heartbeat.test.ts`, `pair-device.test.ts` and `supabase/tests/schema.test.ts` switch the invalid value to `netscape`. These edits match the MODIFIED requirements in this change.

## Summary
- Shared: `FIREFOX_ADDON_ID`, `FIREFOX_UPDATE_URL`, `BROWSER_NAMES` (one list for `PairRequest`, `HeartbeatRequest`, `HeartbeatEnvelope`).
- DB: migration `20261121094741_firefox_browser.sql` re-creates `devices_browser_check` with `firefox`.
- Extension: `buildFirefoxManifest` (MV2, gecko block), `manifestFor` and per-target `wxt.config.ts` (sources zip config), `build:firefox` / `zip:firefox`, root `build` also builds Firefox, `detectBrowser` / `parseBrowserName` / `resolveBadgeApi`, non-persistent background; the controller reads the stored browser through `parseBrowserName`.
- Web: `browserLabel` returns "Firefox".
- Docs: Firefox section in `docs/platform-notes.md`, `apps/extension/CLAUDE.md`.
- Verified by the test files listed in `tasks.md`; `npm run check` and `npm run build` pass (Firefox output: `firefox-mv2`, generated manifest inspected).

## Notes for reviewers
- `wxt.config.ts` default export is a function cast to `UserConfig`: `defineConfig` types accept only objects, but the tests resolve the config per target and WXT calls it without an env, so it falls back to the `-b` CLI flag.
- The MV2 finding in `docs/platform-notes.md` comes from the design, not checked against Mozilla's documentation (no network access); the owner confirms it with the smoke checklist.

## Owner steps after merge (not part of this change)
- Verify the manifest-version finding and the smoke checklist on a real Firefox.
- Sign the unlisted add-on on AMO and host `latest.xpi` and `updates.json` (follow-up issues).
- Follow-up #176: lost-site-access heartbeat value (ADR 0024 fallback if MV2 turns out revocable).
- Follow-up #179: offline alerts with several browsers per child; must land before the Firefox `.reg` (#175, which depends on #179).
