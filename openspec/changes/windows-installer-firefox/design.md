## Decisions
- **Firefox is not a `POLICY_TARGETS` entry.** `POLICY_TARGETS` stays the three Chromium browsers (its scenario is unchanged); Firefox has other value names and no guest-mode or forcelist key. `reg.ts` gets a separate `FIREFOX_POLICY_KEY` and a Firefox block appended after Brave, so today's text is a strict prefix of the new text (after the header).
- **Exact value.** `ExtensionSettings` is `JSON.stringify({ [FIREFOX_ADDON_ID]: { installation_mode: "force_installed", install_url: FIREFOX_INSTALL_URL } })` (key order fixed: `installation_mode`, then `install_url`). `.reg` string escaping is a small exported helper `regString(value)`: backslash first (`\` to `\\`), then quote (`"` to `\"`). The tests unescape in the reverse order and parse the JSON. The JSON is ASCII, so the file stays ASCII.
- **Order of values** in the Firefox key: `ExtensionSettings`, then `DisablePrivateBrowsing`.
- **Constants.** `FIREFOX_INSTALL_URL = "https://family-guardian.co/firefox/latest.xpi"` is added to `packages/shared/src/extension.ts` (already exported through the barrel; `index.ts` is not edited). The add-on ID is `FIREFOX_ADDON_ID` from #173.
- **Safe re-run.** A `.reg` import only writes the listed values and deletes nothing. The Chrome, Edge and Brave lines are byte-identical to today's, so a re-import rewrites the same values. The paired extension's token and data live in the browser profile, not in the registry, so they are untouched. Tests pin this with a literal copy of today's text (prefix check), not with the generator's own output.
- **Remove file** deletes the two Firefox values with `=-` and never a key, as for the other browsers.
- **Instructions.** `InstallInstructions` keeps its steps and adds Firefox in the restart, verify (`about:policies`, `ExtensionSettings`, `DisablePrivateBrowsing`) and pair steps. The `/setup` guide keeps its eight steps; the `restart` and `pair` messages mention Firefox in all three locales (each browser needs its own pairing code, from the same child).
- **Order relative to #174.** Until the owner publishes the first release, `latest.xpi` is a 404 and Firefox shows an install error for the forced add-on; nothing else breaks and nothing is sent. Noted in NOTES.md.

## Data model
None. No table, column, stored or logged data; the files contain public constants only.

## Contracts
`@fg/shared` gains `FIREFOX_INSTALL_URL` (additive). Download routes, file names and headers do not change. No device API change; installed extensions are unaffected.

## Failure modes
None of its own: pure string generation, no database, API or storage call. A `.reg` that fails to import in Registry Editor changes nothing. A missing `latest.xpi` (see above) fails safe: Chromium enforcement is independent of Firefox.

## Alternatives
- Separate Firefox `.reg` files: parents could forget to run the second; ADR 0024 specifies one setup file.
- Adding Firefox to `POLICY_TARGETS` with optional fields: changes the pinned shape of the Chromium table for no benefit.
- Policy `Extensions.Install` instead of `ExtensionSettings`: it does not prevent removal; ADR 0024 requires `force_installed`.

## ADR impact
Follows ADR 0024 (install policy, remove file, unchanged Chromium entries) and ADR 0005 (nothing collected or sent). No new or changed ADR.
