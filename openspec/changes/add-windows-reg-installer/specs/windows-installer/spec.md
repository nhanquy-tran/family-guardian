# Spec Delta

## Purpose

A parent can download a policy file that force-installs the Family Guardian extension and disables private browsing in Chrome, Edge and Brave on Windows, a matching file that removes it, and instructions to apply and verify it.

Test files:
- `apps/web/src/lib/installer/reg.test.ts`
- `apps/web/src/lib/installer/download.test.ts`
- `apps/web/src/components/install-instructions.test.ts`

## ADDED Requirements

### Requirement: Policy targets
The generator SHALL target exactly three browsers in this order, each with its HKLM policy key and private-mode policy name: Chrome `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome` with `IncognitoModeAvailability`; Edge `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge` with `InPrivateModeAvailability`; Brave `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\BraveSoftware\Brave` with `IncognitoModeAvailability`.

#### Scenario: Targets are fixed
- **WHEN** a test reads the exported `POLICY_TARGETS` (`reg.test.ts`)
- **THEN** it equals the three `{ browser, key, privateModeValue }` entries above in the order Chrome, Edge, Brave

### Requirement: Registry file format
Both generated files SHALL start with the line `Windows Registry Editor Version 5.00` followed by an empty line, use CRLF line endings only, end with CRLF, and contain only ASCII characters.

#### Scenario: Header and line endings
- **WHEN** `buildSetupReg()` and `buildRemoveReg()` are called (`reg.test.ts`)
- **THEN** each string starts with `"Windows Registry Editor Version 5.00\r\n\r\n"`
- **AND** each ends with `"\r\n"`
- **AND** removing every `"\r\n"` leaves no `"\r"` or `"\n"` character
- **AND** every character code is below 128

### Requirement: Setup file sets force-install and disables private mode
`buildSetupReg()` SHALL, for each policy target, set `"<privateModeValue>"=dword:00000001` under `[<key>]` and `"1"="<EXTENSION_ID>;<CHROME_WEB_STORE_UPDATE_URL>"` under `[<key>\ExtensionInstallForcelist]`, using the constants from `@fg/shared`. It SHALL set no other values.

#### Scenario: Force-install entry for each browser
- **WHEN** `buildSetupReg()` is called (`reg.test.ts`)
- **THEN** for each of Chrome, Edge and Brave it contains the line `[<key>\ExtensionInstallForcelist]` immediately followed by the line `"1"="mohnkinbpagpelmlfmgkgaplfikdjjcb;https://clients2.google.com/service/update2/crx"`
- **AND** the value line is built from `EXTENSION_ID` and `CHROME_WEB_STORE_UPDATE_URL` imported from `@fg/shared`

#### Scenario: Private mode disabled for each browser
- **WHEN** `buildSetupReg()` is called (`reg.test.ts`)
- **THEN** it contains `[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome]` followed by `"IncognitoModeAvailability"=dword:00000001`
- **AND** `[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge]` followed by `"InPrivateModeAvailability"=dword:00000001`
- **AND** `[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\BraveSoftware\Brave]` followed by `"IncognitoModeAvailability"=dword:00000001`

#### Scenario: Nothing else is set
- **WHEN** `buildSetupReg()` is called (`reg.test.ts`)
- **THEN** it has exactly 6 key lines (starting with `[`), all under `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\`, and exactly 6 value lines (starting with `"`)

### Requirement: Remove file deletes exactly the setup values
`buildRemoveReg()` SHALL contain, for the same keys as the setup file, the deletion lines `"<privateModeValue>"=-` and `"1"=-`, and nothing else. It SHALL NOT delete any key.

#### Scenario: Deletes the values set by setup
- **WHEN** `buildSetupReg()` and `buildRemoveReg()` are called (`reg.test.ts`)
- **THEN** the remove file has the same key lines in the same order as the setup file
- **AND** for every setup value line `"<name>"=<data>` the remove file has `"<name>"=-` under the same key, and it has no other value lines

#### Scenario: No key is deleted
- **WHEN** `buildRemoveReg()` is called (`reg.test.ts`)
- **THEN** no line starts with `[-`

### Requirement: Download routes
`GET /install/FamilyGuardian-Setup.reg` and `GET /install/FamilyGuardian-Remove.reg` SHALL return status 200 with the setup and remove file bodies, `Content-Type: application/octet-stream` and `Content-Disposition: attachment; filename="<file name>"`. They SHALL NOT require sign-in.

#### Scenario: Download response headers
- **WHEN** a test calls `regDownload("FamilyGuardian-Setup.reg", "x")` (`download.test.ts`)
- **THEN** the response has status 200, header `content-type` `application/octet-stream`, header `content-disposition` `attachment; filename="FamilyGuardian-Setup.reg"` and body text `"x"`

#### Scenario: Routes serve the generated files
- **WHEN** a test imports `GET` from `apps/web/src/app/install/FamilyGuardian-Setup.reg/route.ts` and from `.../FamilyGuardian-Remove.reg/route.ts` and calls each (`download.test.ts`)
- **THEN** the setup body equals `buildSetupReg()` and its `content-disposition` names `FamilyGuardian-Setup.reg`
- **AND** the remove body equals `buildRemoveReg()` and its `content-disposition` names `FamilyGuardian-Remove.reg`

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
- **THEN** the markup contains `chrome://policy`, `edge://policy`, `brave://policy`, `ExtensionInstallForcelist`, `IncognitoModeAvailability` and `InPrivateModeAvailability`
- **AND** the steps are in an ordered list (`<ol`)

#### Scenario: Page and home link exist
- **WHEN** a test reads the file system (`install-instructions.test.ts`)
- **THEN** `apps/web/src/app/install/page.tsx` exists and its source references `InstallInstructions`
- **AND** `apps/web/src/app/page.tsx` contains `href="/install"`
