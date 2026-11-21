## MODIFIED Requirements

### Requirement: Setup file sets force-install and disables private and guest mode
`buildSetupReg()` SHALL, for each policy target, set `"<privateModeValue>"=dword:00000001` and `"BrowserGuestModeEnabled"=dword:00000000` under `[<key>]` and `"1"="<EXTENSION_ID>;<CHROME_WEB_STORE_UPDATE_URL>"` under `[<key>\ExtensionInstallForcelist]`, using the constants from `@fg/shared`. It SHALL then add the Firefox key `[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Mozilla\Firefox]` with `"ExtensionSettings"` and `"DisablePrivateBrowsing"=dword:00000001`. It SHALL set no other values.

#### Scenario: Force-install entry for each browser
- **WHEN** `buildSetupReg()` is called (`reg.test.ts`)
- **THEN** for each of Chrome, Edge and Brave it contains the line `[<key>\ExtensionInstallForcelist]` immediately followed by the line `"1"="mohnkinbpagpelmlfmgkgaplfikdjjcb;https://clients2.google.com/service/update2/crx"`
- **AND** the value line is built from `EXTENSION_ID` and `CHROME_WEB_STORE_UPDATE_URL` imported from `@fg/shared`

#### Scenario: Private mode disabled for each browser
- **WHEN** `buildSetupReg()` is called (`reg.test.ts`)
- **THEN** it contains `[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome]` followed by `"IncognitoModeAvailability"=dword:00000001`
- **AND** `[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge]` followed by `"InPrivateModeAvailability"=dword:00000001`
- **AND** `[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\BraveSoftware\Brave]` followed by `"IncognitoModeAvailability"=dword:00000001`

#### Scenario: Guest mode disabled for each browser
- **WHEN** `buildSetupReg()` is called (`reg.test.ts`)
- **THEN** under each of the three `[<key>]` lines (Chrome, Edge, Brave) the section contains `"BrowserGuestModeEnabled"=dword:00000000`

#### Scenario: Nothing else is set
- **WHEN** `buildSetupReg()` is called (`reg.test.ts`)
- **THEN** it has exactly 7 key lines (starting with `[`), all under `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\`, and exactly 11 value lines (starting with `"`)
- **AND** no line starts with `[-` and no value line ends with `=-`

#### Scenario: Chrome, Edge and Brave lines are unchanged
- **WHEN** `buildSetupReg()` is called (`reg.test.ts`)
- **THEN** the result starts with `"Windows Registry Editor Version 5.00\r\n\r\n"` followed by a literal copy, written in the test, of the Chrome, Edge and Brave sections as generated before this change (every line of the text below before `[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Mozilla\Firefox]`, each ending in `\r\n`)

#### Scenario: Full expected setup file
- **WHEN** `buildSetupReg()` is called (`reg.test.ts`)
- **THEN** the result equals exactly this text, every line ending in `\r\n`:
  ```
  Windows Registry Editor Version 5.00

  [HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome]
  "IncognitoModeAvailability"=dword:00000001
  "BrowserGuestModeEnabled"=dword:00000000

  [HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist]
  "1"="mohnkinbpagpelmlfmgkgaplfikdjjcb;https://clients2.google.com/service/update2/crx"

  [HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge]
  "InPrivateModeAvailability"=dword:00000001
  "BrowserGuestModeEnabled"=dword:00000000

  [HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist]
  "1"="mohnkinbpagpelmlfmgkgaplfikdjjcb;https://clients2.google.com/service/update2/crx"

  [HKEY_LOCAL_MACHINE\SOFTWARE\Policies\BraveSoftware\Brave]
  "IncognitoModeAvailability"=dword:00000001
  "BrowserGuestModeEnabled"=dword:00000000

  [HKEY_LOCAL_MACHINE\SOFTWARE\Policies\BraveSoftware\Brave\ExtensionInstallForcelist]
  "1"="mohnkinbpagpelmlfmgkgaplfikdjjcb;https://clients2.google.com/service/update2/crx"

  [HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Mozilla\Firefox]
  "ExtensionSettings"="{\"guardian@family-guardian.co\":{\"installation_mode\":\"force_installed\",\"install_url\":\"https://family-guardian.co/firefox/latest.xpi\"}}"
  "DisablePrivateBrowsing"=dword:00000001

  ```
  (the file ends with the last value line's `\r\n`, an empty line, then end of text; the test builds the expected text from the constants and a literal copy of the paths above)

### Requirement: Remove file deletes exactly the setup values
`buildRemoveReg()` SHALL contain, for the same keys as the setup file, the deletion lines `"<privateModeValue>"=-`, `"BrowserGuestModeEnabled"=-` and `"1"=-` for the three Chromium browsers and `"ExtensionSettings"=-` and `"DisablePrivateBrowsing"=-` under the Firefox key, and nothing else. It SHALL NOT delete any key.

#### Scenario: Deletes the values set by setup
- **WHEN** `buildSetupReg()` and `buildRemoveReg()` are called (`reg.test.ts`)
- **THEN** the remove file has the same key lines in the same order as the setup file
- **AND** for every setup value line `"<name>"=<data>` the remove file has `"<name>"=-` under the same key, and it has no other value lines

#### Scenario: Guest mode value is removed
- **WHEN** `buildRemoveReg()` is called (`reg.test.ts`)
- **THEN** it contains `"BrowserGuestModeEnabled"=-` exactly three times, once under each of the Chrome, Edge and Brave policy keys

#### Scenario: Firefox values are removed
- **WHEN** `buildRemoveReg()` is called (`reg.test.ts`)
- **THEN** the section under `[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Mozilla\Firefox]` has exactly the two value lines `"ExtensionSettings"=-` and `"DisablePrivateBrowsing"=-`, in that order

#### Scenario: Full expected remove file
- **WHEN** `buildRemoveReg()` is called (`reg.test.ts`)
- **THEN** the result equals exactly the setup text above with each value line replaced by `"<name>"=-` (private-mode name, `BrowserGuestModeEnabled` and `"1"` per Chromium browser; `ExtensionSettings` and `DisablePrivateBrowsing` for Firefox), the same key lines and blank lines, and CRLF endings

#### Scenario: No key is deleted
- **WHEN** `buildRemoveReg()` is called (`reg.test.ts`)
- **THEN** no line starts with `[-`

### Requirement: Install instructions page
The `/install` page SHALL render `InstallInstructions`, which shows download links to both files and step-by-step instructions. The Standard-account warning SHALL appear before the first download link. The instructions SHALL explain how to verify the policy in `chrome://policy`, `edge://policy`, `brave://policy` and `about:policies`, and SHALL cover Firefox: same file, reopen it, pair with a new code for the same child. The public home page SHALL link to `/install`.

#### Scenario: Download links
- **WHEN** a test renders `InstallInstructions` with `renderToStaticMarkup` (`install-instructions.test.ts`)
- **THEN** the markup contains `<a` elements with `href="/install/FamilyGuardian-Setup.reg"` and `href="/install/FamilyGuardian-Remove.reg"`, each with a `download` attribute

#### Scenario: Standard-account warning comes first
- **WHEN** a test renders `InstallInstructions` (`install-instructions.test.ts`)
- **THEN** the markup contains "Standard" and "Administrator"
- **AND** the first occurrence of "Standard" is before the first occurrence of `FamilyGuardian-Setup.reg`

#### Scenario: Verification steps
- **WHEN** a test renders `InstallInstructions` (`install-instructions.test.ts`)
- **THEN** the markup contains `chrome://policy`, `edge://policy`, `brave://policy`, `ExtensionInstallForcelist`, `IncognitoModeAvailability`, `InPrivateModeAvailability` and `BrowserGuestModeEnabled`
- **AND** the steps are in an ordered list (`<ol`)

#### Scenario: Firefox steps
- **WHEN** a test renders `InstallInstructions` (`install-instructions.test.ts`)
- **THEN** the markup contains `about:policies`, `ExtensionSettings`, `DisablePrivateBrowsing` and "Firefox"
- **AND** it contains the text "new code" and "same child"
- **AND** the first occurrence of "Firefox" is after the first occurrence of `FamilyGuardian-Setup.reg` and before `FamilyGuardian-Remove.reg`

#### Scenario: Remove leaves empty keys
- **WHEN** a test renders `InstallInstructions` (`install-instructions.test.ts`)
- **THEN** the markup states that Remove deletes only the values Family Guardian set and leaves the (possibly empty) policy keys, by containing the text "empty"
- **AND** it states that guest mode is blocked, by containing the text "guest"

#### Scenario: Page and home link exist
- **WHEN** a test reads the file system (`install-instructions.test.ts`)
- **THEN** `apps/web/src/app/install/page.tsx` exists and its source references `InstallInstructions`
- **AND** `apps/web/src/components/site/home.tsx` contains `href="/install"`

## ADDED Requirements

### Requirement: Firefox policy value
The Firefox `ExtensionSettings` value SHALL be a registry string holding the JSON text `{"<FIREFOX_ADDON_ID>":{"installation_mode":"force_installed","install_url":"<FIREFOX_INSTALL_URL>"}}`, built with `JSON.stringify` from `FIREFOX_ADDON_ID` and the new `@fg/shared` constant `FIREFOX_INSTALL_URL`. The exported helper `regString(value)` SHALL escape backslashes first, then double quotes, for `.reg`.

#### Scenario: Install URL constant
- **WHEN** a test reads `FIREFOX_INSTALL_URL` from `./extension` (`packages/shared/src/extension.test.ts`)
- **THEN** it equals `"https://family-guardian.co/firefox/latest.xpi"`

#### Scenario: Escaping
- **WHEN** a test calls `regString('a\\b"c')` (the characters `a`, backslash, `b`, quote, `c`) (`reg.test.ts`)
- **THEN** the result is the characters `a`, two backslashes, `b`, backslash, quote, `c`
- **AND** `regString('"')` is a backslash followed by a quote, and `regString("plain")` is `plain`

#### Scenario: JSON parses after unescaping
- **WHEN** a test takes the `"ExtensionSettings"=` line of `buildSetupReg()`, strips the outer quotes and unescapes it (`\"` to `"`, then `\\` to `\`) (`reg.test.ts`)
- **THEN** `JSON.parse` of the result equals `{ "guardian@family-guardian.co": { installation_mode: "force_installed", install_url: "https://family-guardian.co/firefox/latest.xpi" } }`
- **AND** the line contains no unescaped quote between the outer quotes

### Requirement: Setup file is safe to run again
Running the setup file on a laptop that already has the Chromium policy SHALL only rewrite the same values: the file SHALL contain no key or value deletion, and its Chrome, Edge and Brave part SHALL be identical to the text generated before Firefox was added.

#### Scenario: Re-run rewrites the same values
- **WHEN** `buildSetupReg()` is called twice and its Chromium part is compared with the literal copy of the earlier text (`reg.test.ts`)
- **THEN** both results are identical
- **AND** the lines of the setup file before `[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Mozilla\Firefox]` equal that literal copy
- **AND** the setup file contains no line starting with `[-` and no value line ending in `=-`
