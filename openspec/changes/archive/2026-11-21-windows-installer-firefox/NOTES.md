## Summary
- `FIREFOX_INSTALL_URL` set in `@fg/shared`; `reg.ts` gained `regString` and a Firefox block (setup writes `ExtensionSettings`, `DisablePrivateBrowsing`, `DisableSafeMode`; remove deletes those values). The Chromium text is unchanged.
- `InstallInstructions` and the en/vi/zh `/setup` `restart` and `pair` steps mention Firefox.
- Verified by `reg.test.ts` (full texts, prefix, escaping, JSON, re-run), `install-instructions.test.ts`, `setup-guide.test.tsx`, `extension.test.ts`. `npm run check` and `npm run build` pass.

## Owner steps
- Before or with this deploy, commit the first signed Firefox release with `npm run firefox:release -w extension`. Merging #174 does not publish `latest.xpi`, and the install page tells parents to pair Firefox, so shipping the instructions first makes the forced install fail.
- Smoke checklist step 9 (`docs/platform-notes.md`): Help > Troubleshoot Mode is greyed out after the setup `.reg`.

## Docs to update
- `openspec/specs/windows-installer/spec.md` Purpose: at archive, change "Chrome, Edge and Brave" to "Chrome, Edge, Brave and Firefox" (Firefox: force-install, private browsing and Troubleshoot Mode off).
- Remove file scope: it deletes the whole Firefox `ExtensionSettings` value and the Chromium forcelist entry `1`, not only our entry. Entries set by a family or another tool in those values are lost; the `InstallInstructions` remove text says so.
- `docs/platform-notes.md`: Troubleshoot Mode and `DisableSafeMode` line and smoke step 9 (added in this change).
- `docs/platform-notes.md`: Firefox smoke checklist step 1 now starts from the setup `.reg` (policy installs the add-on). Until #174's first signed release is published, Firefox reports an install error for `latest.xpi`.
- `docs/platform-notes.md`: Firefox reads `HKLM\SOFTWARE\Policies\Mozilla\Firefox`; verify in `about:policies`.
- `docs/architecture.md`: installer section lists the Firefox policy values next to Chrome, Edge and Brave.
