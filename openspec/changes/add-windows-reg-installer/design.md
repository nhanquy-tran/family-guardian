# Design

## Context

`apps/web` is a bare Next.js 16 App Router app (`layout.tsx`, `page.tsx`, `privacy/`). The sign-in change (issue #8) is specced but not merged, so there is no `/dashboard` yet. `packages/shared/src/extension.ts` exports `EXTENSION_ID` (`mohnkinbpagpelmlfmgkgaplfikdjjcb`) and `CHROME_WEB_STORE_UPDATE_URL` (`https://clients2.google.com/service/update2/crx`). Vitest picks up `apps/*/src/**/*.test.ts`. Requirements are in `specs/windows-installer/spec.md`.

## Goals / Non-Goals

**Goals:** a correct, tested Setup and Remove `.reg` for Chrome, Edge and Brave; a download link; clear instructions a non-technical parent can follow.

**Non-Goals:** extra hardening policies, native installers, dashboard integration.

## Decisions

1. **Policy targets as data.** `src/lib/installer/reg.ts` exports
   `POLICY_TARGETS = [
     { browser: "Chrome", key: "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome", privateModeValue: "IncognitoModeAvailability" },
     { browser: "Edge", key: "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Edge", privateModeValue: "InPrivateModeAvailability" },
     { browser: "Brave", key: "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\BraveSoftware\\Brave", privateModeValue: "IncognitoModeAvailability" },
   ] as const`.
   Edge ignores `IncognitoModeAvailability`; its documented equivalent is `InPrivateModeAvailability` where `1` means disabled. This is the only deviation from the issue text and is flagged in the proposal.

2. **Generator.** `buildSetupReg()` and `buildRemoveReg()` return strings, built from lines joined with `\r\n` and ending with `\r\n`. No parameters; they import the two constants from `@fg/shared`.
   Setup, per target in order Chrome, Edge, Brave:
   ```
   [<key>]
   "<privateModeValue>"=dword:00000001

   [<key>\ExtensionInstallForcelist]
   "1"="mohnkinbpagpelmlfmgkgaplfikdjjcb;https://clients2.google.com/service/update2/crx"

   ```
   Remove: same keys, `"<privateModeValue>"=-` and `"1"=-`. Keys themselves are never deleted (`[-...]` is not used), so other policies the family set stay intact.
   File starts with `Windows Registry Editor Version 5.00` then a blank line. Values contain no `\` or `"`, so no escaping is needed. Content is ASCII, which `regedit` accepts without a BOM.
   Value name `"1"` overwrites an existing first forcelist entry, and Remove deletes it. Acceptable for home laptops without other managed extensions.

3. **Download routes.** `src/lib/installer/download.ts` exports `REG_FILES = { setup: "FamilyGuardian-Setup.reg", remove: "FamilyGuardian-Remove.reg" }` and `regDownload(filename, body): Response` with status 200, `Content-Type: application/octet-stream` and `Content-Disposition: attachment; filename="<filename>"`. Route handlers `src/app/install/FamilyGuardian-Setup.reg/route.ts` and `.../FamilyGuardian-Remove.reg/route.ts` export `GET` calling `regDownload`. The URL matches the filename so a plain `<a href download>` works. No auth: the content is identical for everyone and the extension ID is already in this public repo (ADR 0008).

4. **Instructions as a component.** `src/components/install-instructions.tsx` exports `InstallInstructions()` (server component, no client JS) so `/dashboard/install` can reuse it later. `src/app/install/page.tsx` renders it with a page title. Content, in order:
   1. Warning: the child must use a **Standard** Windows account, not Administrator, or they can delete the policy; how to check (Settings → Accounts → Family / Other users → Change account type).
   2. On the child's laptop, sign in as (or have the password of) an administrator; download the Setup file.
   3. Double-click it, accept the UAC prompt and the Registry Editor warning.
   4. Fully close and reopen Chrome, Edge and Brave.
   5. Verify: open `chrome://policy`, `edge://policy`, `brave://policy`, click "Reload policies", check `ExtensionInstallForcelist` and `IncognitoModeAvailability` (`InPrivateModeAvailability` in Edge) show status OK; Family Guardian appears in the extensions page as installed by your organisation; a private window cannot be opened.
   6. Then pair the extension with the code from the dashboard.
   7. To remove: download and run the Remove file as administrator, restart browsers.
   Rendered with `renderToStaticMarkup` in tests via `createElement` from a `.test.ts` file; adjust the root `vitest.config.ts` JSX setting only if Vitest cannot transform the `.tsx` import.

## Risks / Trade-offs

- [Child has an admin account] → Prominent warning first on the page; out of our control otherwise.
- [Chrome Web Store item not yet published] → Force-install silently does nothing until it is (ADR 0009); the verify step makes this visible.
- [Brave Tor windows] → Out of scope; follow-up can add `TorDisabled`.
- [Existing forcelist entry `"1"`] → Rare on home PCs; documented.
