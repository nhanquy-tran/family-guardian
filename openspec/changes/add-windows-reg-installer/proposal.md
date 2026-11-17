# Proposal

Implements GitHub issue #17 ("Windows installer: generate a .reg file for Chrome, Edge and Brave").

## Why

ADR 0002 locks the extension in with a browser policy file, and ADR 0009 makes Windows with Chrome, Edge and Brave the MVP target. Parents have no way to get that file yet, so the extension can be removed or bypassed in a private window.

## What Changes

- A unit-tested generator `apps/web/src/lib/installer/reg.ts` that builds two `.reg` files from `EXTENSION_ID` and `CHROME_WEB_STORE_UPDATE_URL` (`packages/shared/src/extension.ts`):
  - `FamilyGuardian-Setup.reg`: for Chrome, Edge and Brave under `HKEY_LOCAL_MACHINE\SOFTWARE\Policies`, sets `ExtensionInstallForcelist` value `"1"` = `<id>;<update url>`, disables private browsing and disables guest mode (`BrowserGuestModeEnabled`=0, because guest windows do not load extensions).
  - `FamilyGuardian-Remove.reg`: deletes exactly those values, nothing else (keys are left in place, possibly empty).
  - `Windows Registry Editor Version 5.00` header, CRLF line endings, ASCII only.
- One dynamic download route `GET /install/[file]` serving `FamilyGuardian-Setup.reg` and `FamilyGuardian-Remove.reg` (attachment, no auth: the content is the same for every family and holds no secret); any other name returns 404.
- A public `/install` page with step-by-step instructions: the Standard-account warning, running the file, restarting browsers, verifying in `chrome://policy` / `edge://policy` / `brave://policy`, and removal.
- A "Install on your child's laptop" link from the home page to `/install`.
- `docs/architecture.md` key flow 7 updated with the Edge policy name (see below).

**Decided deviation from the issue wording (owner gate decision):** Edge does not support `IncognitoModeAvailability`; its equivalent is `InPrivateModeAvailability` (1 = disabled). The spec sets `IncognitoModeAvailability=1` for Chrome and Brave and `InPrivateModeAvailability=1` for Edge, which delivers the intent (no private windows in any of the three browsers).

## Capabilities

### New Capabilities

- `windows-installer`: `.reg` generation, download routes and the install instructions page.

### Modified Capabilities

None.

## Impact

- New files under `apps/web/src/lib/installer/`, `apps/web/src/components/`, `apps/web/src/app/install/`. Home page gets one link. No new dependencies, no database change, no new env vars.
- No data collected from children; ADR 0005 is unaffected.
- Independent of issue #8 (sign-in): the page is public.

## Out of scope

- Showing the instructions inside `/dashboard/install` (placeholder from issue #8); a follow-up can render the same component there.
- Disabling Brave Tor windows (`TorDisabled`), Firefox, developer mode or other hardening policies.
- An `.exe`/`.msi` installer, code signing, Mac/Linux.
- Detecting from the dashboard whether the policy is active on a device.
- Pairing instructions beyond a one-line pointer (pairing is a separate issue).
