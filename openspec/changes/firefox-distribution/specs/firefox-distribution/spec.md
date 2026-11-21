## Purpose
The signed Firefox add-on and its update manifest are served publicly from family-guardian.co/firefox/, and a release script publishes each AMO-signed file safely, so Firefox can install and update the add-on by policy.

Test files:
- `apps/web/src/app/firefox-public.test.ts`
- `apps/extension/scripts/firefox-release.test.ts`

## ADDED Requirements

### Requirement: Public update manifest
`apps/web/public/firefox/updates.json` SHALL be a valid Firefox update manifest for `FIREFOX_ADDON_ID`: `addons[<id>].updates` is a list, ascending by version, whose entries each have `version`, `update_link` (`https://family-guardian.co/firefox/family-guardian-<version>.xpi`) and `update_hash` (`sha256:<64 hex>`). The file SHALL be committed with an empty list.

#### Scenario: Manifest has the Firefox format
- **GIVEN** the committed `updates.json`
- **WHEN** `firefox-public.test.ts` parses it
- **THEN** its only key under `addons` is `FIREFOX_ADDON_ID` and `updates` is an array
- **AND** each entry has the three fields above with the stated link and hash shapes, versions ascending

#### Scenario: Manifest and files agree
- **GIVEN** the files in `apps/web/public/firefox/`
- **WHEN** `firefox-public.test.ts` compares them to `updates.json`
- **THEN** every `update_link` names an existing versioned `.xpi`, and `latest.xpi` exists if and only if the list is not empty
- **AND** when it exists, `latest.xpi` has the same bytes as the newest listed `.xpi`

#### Scenario: Before any release
- **GIVEN** no `.xpi` in `apps/web/public/firefox/`
- **WHEN** `firefox-public.test.ts` reads the directory and `updates.json`
- **THEN** `latest.xpi` does not exist and `updates` is empty

### Requirement: Public serving
`/firefox/updates.json` and `/firefox/*.xpi` SHALL be public with no login, and `.xpi` files SHALL be served with `Content-Type: application/x-xpinstall`. A missing `latest.xpi` SHALL give 404. The paths SHALL NOT appear in the sitemap or in any page.

#### Scenario: Content type for add-on files
- **WHEN** `firefox-public.test.ts` calls `headers()` of `apps/web/next.config.ts`
- **THEN** a rule for `/firefox/:file*.xpi` sets `Content-Type` to `application/x-xpinstall`

#### Scenario: No login and not listed
- **WHEN** `firefox-public.test.ts` reads the `matcher` of `apps/web/src/proxy.ts` and calls `sitemap()`
- **THEN** no matcher entry covers `/firefox` and no sitemap URL contains `/firefox`

### Requirement: Release script
`npm run firefox:release -w extension -- <signed.xpi>` SHALL store a valid file as `family-guardian-<version>.xpi`, copy it to `latest.xpi` and add the version to `updates.json` (`update_hash` is the SHA-256 of the file). On any failure it SHALL exit non-zero and change nothing.

#### Scenario: First release
- **GIVEN** an empty output directory with the committed empty `updates.json` and a valid signed test `.xpi` for the build version
- **WHEN** `firefox-release.test.ts` runs the release function
- **THEN** `family-guardian-<version>.xpi` and `latest.xpi` exist with the input's bytes
- **AND** `updates.json` lists exactly that version with the right `update_link` and `update_hash`

#### Scenario: Next release keeps the older one
- **GIVEN** a stored release `0.3.0`
- **WHEN** the test releases a valid `0.3.1` file (build version `0.3.1`)
- **THEN** both versioned files exist, `updates` lists `0.3.0` then `0.3.1`, and `latest.xpi` equals the `0.3.1` file

### Requirement: Release validation
The release script SHALL accept a file only if it is a zip containing `manifest.json` whose `browser_specific_settings.gecko.id` equals `FIREFOX_ADDON_ID` and whose `version` equals the build version (`apps/extension/package.json`), it contains `META-INF/mozilla.rsa` (AMO signature), and its version is greater than the newest listed.

#### Scenario: Wrong add-on ID
- **WHEN** the test releases a file whose manifest ID is another ID
- **THEN** the function rejects and the directory is unchanged

#### Scenario: Wrong version
- **WHEN** the test releases a file whose manifest version differs from the build version
- **THEN** the function rejects and the directory is unchanged

#### Scenario: Unsigned file
- **WHEN** the test releases a zip without `META-INF/mozilla.rsa`
- **THEN** the function rejects and the directory is unchanged

#### Scenario: Not a zip or no manifest
- **WHEN** the test releases a text file, then a zip without `manifest.json`
- **THEN** each call rejects and the directory is unchanged

#### Scenario: Same or older version
- **GIVEN** a stored release `0.3.1`
- **WHEN** the test releases a valid file for `0.3.1`, then one for `0.3.0` (matching build versions)
- **THEN** each call rejects, and the stored `.xpi` bytes, `latest.xpi` and `updates.json` are unchanged

#### Scenario: Write failure keeps the old release
- **GIVEN** a stored release and an output directory where writing `updates.json` fails (the test injects a failing write)
- **WHEN** the test releases a newer valid file
- **THEN** the call rejects and `updates.json` still lists only the old release

#### Scenario: Command-line wiring
- **WHEN** `firefox-release.test.ts` reads `apps/extension/package.json`
- **THEN** the script `firefox:release` exists and runs `scripts/firefox-release.ts`
