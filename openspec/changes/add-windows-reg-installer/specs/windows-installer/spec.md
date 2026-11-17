# Spec Delta

## Purpose

A parent can download a policy file that force-installs the Family Guardian extension and disables private browsing and guest mode in Chrome, Edge and Brave on Windows, a matching file that removes it, and instructions to apply and verify it.

Test files:
- `apps/web/src/lib/installer/reg.test.ts`
- `apps/web/src/lib/installer/download.test.ts`
- `apps/web/src/components/install-instructions.test.ts`

## ADDED Requirements

### Requirement: Policy targets
The generator SHALL target exactly three browsers in this order, each with an HKLM policy key and a private-mode policy name, and every target also gets the guest-mode policy `BrowserGuestModeEnabled` (guest windows do not load extensions).

#### Scenario: Targets are fixed
- **WHEN** a test reads the exported `POLICY_TARGETS` (`reg.test.ts`)
- **THEN** it equals these `{ browser, key, privateModeValue }` entries in the order Chrome, Edge, Brave:
  - Chrome, `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome`, `IncognitoModeAvailability`
  - Edge, `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge`, `InPrivateModeAvailability`
  - Brave, `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\BraveSoftware\Brave`, `IncognitoModeAvailability`

### Requirement: Registry file format
Both generated files SHALL start with the line `Windows Registry Editor Version 5.00` followed by an empty line, use CRLF line endings only, end with CRLF, and contain only ASCII characters.

#### Scenario: Header and line endings
- **WHEN** `buildSetupReg()` and `buildRemoveReg()` are called (`reg.test.ts`)
- **THEN** each string starts with `"Windows Registry Editor Version 5.00\r\n\r\n"`
- **AND** each ends with `"\r\n"`
- **AND** removing every `"\r\n"` leaves no `"\r"` or `"\n"` character
- **AND** every character code is below 128

### Requirement: Setup file sets force-install and disables private and guest mode
`buildSetupReg()` SHALL, for each policy target, set `"<privateModeValue>"=dword:00000001` and `"BrowserGuestModeEnabled"=dword:00000000` under `[<key>]` and `"1"="<EXTENSION_ID>;<CHROME_WEB_STORE_UPDATE_URL>"` under `[<key>\ExtensionInstallForcelist]`, using the constants from `@fg/shared`. It SHALL set no other values.

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
- **THEN** it has exactly 6 key lines (starting with `[`), all under `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\`, and exactly 9 value lines (starting with `"`)

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

  ```
  (the file ends with the last value line's `\r\n`, an empty line, then end of text; the test builds the expected text from the constants and a literal copy of the paths above)

### Requirement: Remove file deletes exactly the setup values
`buildRemoveReg()` SHALL contain, for the same keys as the setup file, the deletion lines `"<privateModeValue>"=-`, `"BrowserGuestModeEnabled"=-` and `"1"=-`, and nothing else. It SHALL NOT delete any key.

#### Scenario: Deletes the values set by setup
- **WHEN** `buildSetupReg()` and `buildRemoveReg()` are called (`reg.test.ts`)
- **THEN** the remove file has the same key lines in the same order as the setup file
- **AND** for every setup value line `"<name>"=<data>` the remove file has `"<name>"=-` under the same key, and it has no other value lines

#### Scenario: Guest mode value is removed
- **WHEN** `buildRemoveReg()` is called (`reg.test.ts`)
- **THEN** it contains `"BrowserGuestModeEnabled"=-` exactly three times, once under each of the Chrome, Edge and Brave policy keys

#### Scenario: Full expected remove file
- **WHEN** `buildRemoveReg()` is called (`reg.test.ts`)
- **THEN** the result equals exactly the setup text above with each value line replaced by `"<name>"=-` (private-mode name, `BrowserGuestModeEnabled`, and `"1"` per browser), the same key lines and blank lines, and CRLF endings

#### Scenario: No key is deleted
- **WHEN** `buildRemoveReg()` is called (`reg.test.ts`)
- **THEN** no line starts with `[-`

### Requirement: Download routes
`GET /install/FamilyGuardian-Setup.reg` and `GET /install/FamilyGuardian-Remove.reg` SHALL return status 200 with the setup and remove file bodies, `Content-Type: application/octet-stream` and `Content-Disposition: attachment; filename="<file name>"`. They SHALL NOT require sign-in. Any other file name under `/install/` handled by the route SHALL return 404 and never a registry file. Other HTTP methods are not exported, so Next.js answers 405.

#### Scenario: Download response headers
- **WHEN** a test calls `regDownload("FamilyGuardian-Setup.reg", "x")` (`download.test.ts`)
- **THEN** the response has status 200, header `content-type` `application/octet-stream`, header `content-disposition` `attachment; filename="FamilyGuardian-Setup.reg"` and body text `"x"`

#### Scenario: Route serves the generated files
- **WHEN** a test imports `GET` from `apps/web/src/app/install/[file]/route.ts` and calls it with `params` resolving to `{ file: "FamilyGuardian-Setup.reg" }` and then `{ file: "FamilyGuardian-Remove.reg" }` (`download.test.ts`)
- **THEN** the setup body equals `buildSetupReg()` and its `content-disposition` names `FamilyGuardian-Setup.reg`
- **AND** the remove body equals `buildRemoveReg()` and its `content-disposition` names `FamilyGuardian-Remove.reg`

#### Scenario: Unknown file name returns 404
- **WHEN** a test calls `GET` with `params` resolving to `{ file: "other.reg" }`, to `{ file: "../package.json" }` and to `{ file: "familyguardian-setup.reg" }` (`download.test.ts`)
- **THEN** each response has status 404, no `content-disposition` header and a body that contains no registry text (no `Windows Registry Editor`)

#### Scenario: Only known names are served
- **WHEN** a test reads `REG_FILES` and calls `regFileResponse` with `"toString"` and `"__proto__"` (`download.test.ts`)
- **THEN** both return status 404 (lookup uses own properties only)

### Requirement: Install instructions page
The `/install` page SHALL render `InstallInstructions`, which shows download links to both files and step-by-step instructions. The Standard-account warning SHALL appear before the first download link. The instructions SHALL explain how to verify the policy in `chrome://policy`, `edge://policy` and `brave://policy`. The home page SHALL link to `/install`.

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

#### Scenario: Remove leaves empty keys
- **WHEN** a test renders `InstallInstructions` (`install-instructions.test.ts`)
- **THEN** the markup states that Remove deletes only the values Family Guardian set and leaves the (possibly empty) policy keys, by containing the text "empty"
- **AND** it states that guest mode is blocked, by containing the text "guest"

#### Scenario: Page and home link exist
- **WHEN** a test reads the file system (`install-instructions.test.ts`)
- **THEN** `apps/web/src/app/install/page.tsx` exists and its source references `InstallInstructions`
- **AND** `apps/web/src/app/page.tsx` contains `href="/install"`
