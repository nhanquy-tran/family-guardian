VERIFY: PASS

## Verification Report: firefox-extension

| Dimension | Status |
|---|---|
| Completeness | 18/18 tasks ticked; all ADDED/MODIFIED requirements have code and tests |
| Correctness | All requirements covered (read code and tests, not titles). `npm run check` and `build` not re-run by the verifier (shell restricted) |
| Coherence | Followed; no contradiction with specs or ADRs 0005 and 0024 |

### CRITICAL
None.

### WARNING
- `apps/extension/wxt.config.ts:29-37`: the `zip` sources config (`sourcesRoot`, include and exclude lists) is applied only when the target is Firefox. The spec says "the WXT `zip` config SHALL set `sourcesRoot`...". Behaviour is correct for the AMO sources zip, and the Chromium zip is unchanged. Make sure `build-config.test.ts` reads it for the Firefox target, as the scenario implies.
- `docs/architecture.md` is not updated. NOTES.md lists it under "Docs to update", so the docs-writer handles it after merge.
- `npm run check` and `npm run build` were not re-run by the verifier. The NOTES.md claim that they pass is unconfirmed here, so the pipeline gate must confirm it.

### SUGGESTION
- `supabase/migrations/20261121094741_firefox_browser.sql:1`: the migration drops and re-adds a check constraint. `supabase/CLAUDE.md` says dropping needs an ADR. The delta spec explicitly requires this exact shape and it is additive in effect (the allowed set only widens), so I treat it as accepted.
- `apps/extension/entrypoints/background.ts:8`: `persistent: false` is set for every target. The spec only requires it for Firefox, and the Chromium manifest has no `persistent` key (tested in `build-config.test.ts:28-29`), so this is harmless.
- `apps/extension/lib/manifest.ts:11`: the MV2 finding comes from the design and was not checked against Mozilla documentation (see NOTES.md). The owner confirms it with the smoke checklist.

### Per-requirement verdicts
- Firefox manifest identity and data declaration: `manifest.ts:14-26`, shared constants. Tested in `manifest.test.ts` and `extension.test.ts`. OK.
- Same permissions as Chromium: `buildFirefoxManifest` spreads `buildManifest`. OK.
- Manifest version pinned to 2: `manifest.ts:12`, `wxt.config.ts:31`. OK.
- Chromium manifest unchanged: `manifestFor` for non-Firefox, fixture compare. OK.
- Firefox target in WXT config and `persistent: false`: `wxt.config.ts`, `background.ts:8`. OK.
- Build scripts and root `build`: `apps/extension/package.json` and root `package.json` are in the diff, covered by `build-config.test.ts`. OK.
- AMO sources zip: see the WARNING above. OK.
- Badge `action ?? browserAction`: `browser-info.ts:19-21`, used at `background.ts:27`. Tested in `browser-info.test.ts` and `badge.test.ts`. OK.
- Several browsers of one child: `supabase/tests/firefox-device.test.ts`. OK.
- Firefox documented: `docs/platform-notes.md` and `firefox-docs.test.ts`. OK.
- `detectBrowser` and `parseBrowserName`: `browser-info.ts:5-25`, `controller.ts:92`, `background.ts:83`. OK.
- Database `devices.browser` check, `PairRequest`, `HeartbeatEnvelope` and `browserLabel`: migration, `contracts.ts`, `pairing.ts` and `status.ts` are in the diff. The tests switched the invalid value to `netscape`, as the spec says. OK.
- Activity tracking, no double count on focus handoff: `tracker.test.ts` has a new test. Not a code change, since the existing tracker already satisfies it. OK.

### Final assessment
No critical issues found. 3 warnings and 3 suggestions to consider.
