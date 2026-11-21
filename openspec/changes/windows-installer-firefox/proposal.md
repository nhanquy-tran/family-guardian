Depends on: #173, #174, #179
Touches: windows-installer, public-site, packages/shared/src/extension.ts

# Windows installer also sets up Firefox

## Why
ADR 0024: the setup `.reg` must also force-install and lock the Firefox add-on, or a child can browse unmonitored in Firefox. The Chrome, Edge and Brave policy stays exactly as it is today, so running the new file on a laptop that already has it is safe.

## What changes
- `buildSetupReg()` appends a Firefox section under `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Mozilla\Firefox`: `ExtensionSettings` (JSON string, force-installs `guardian@family-guardian.co` from `https://family-guardian.co/firefox/latest.xpi`) and `DisablePrivateBrowsing=dword:00000001`.
- `buildRemoveReg()` deletes exactly those two values, plus the existing ones.
- `@fg/shared` gets one constant, `FIREFOX_INSTALL_URL`, next to `FIREFOX_ADDON_ID`.
- `/install` instructions and the `/<locale>/setup` guide list Firefox: run the setup file, open Firefox, pair with a new code for the same child.

## Out of scope
- Serving the `.xpi` and the update manifest (#174), the Firefox build (#173), the offline rule for a closed browser (#179).
- New or changed download routes, file names or the Chrome, Edge and Brave lines.
- Other Firefox policies (`BlockAboutConfig`, `DisableSafeMode`, `DisableDeveloperTools` and similar), non-Windows installers.
- Privacy policy and FAQ text (own issue).
