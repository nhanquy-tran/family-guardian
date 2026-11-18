## MODIFIED Requirements

### Requirement: Install instructions page
The `/install` page SHALL render `InstallInstructions`, which shows download links to both files and step-by-step instructions. The Standard-account warning SHALL appear before the first download link. The instructions SHALL explain how to verify the policy in `chrome://policy`, `edge://policy` and `brave://policy`. The public home page SHALL link to `/install`.

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
- **AND** `apps/web/src/components/site/home.tsx` contains `href="/install"`
