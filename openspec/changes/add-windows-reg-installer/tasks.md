# Tasks

## 1. Tests first

- [x] 1.1 Write `apps/web/src/lib/installer/reg.test.ts`, `apps/web/src/lib/installer/download.test.ts` and `apps/web/src/components/install-instructions.test.ts` with one test per scenario in `specs/windows-installer/spec.md` (components rendered with `createElement` + `renderToStaticMarkup`); verify they fail only because the modules do not exist yet

## 2. Generator

- [x] 2.1 Add `apps/web/src/lib/installer/reg.ts` (`POLICY_TARGETS`, `buildSetupReg`, `buildRemoveReg`) per design.md, importing `EXTENSION_ID` and `CHROME_WEB_STORE_UPDATE_URL` from `@fg/shared`; verify `reg.test.ts` passes

## 3. Downloads and page

- [x] 3.1 Add `apps/web/src/lib/installer/download.ts` (`REG_FILES`, `regDownload`, `regFileResponse`) and route handlers `apps/web/src/app/install/[file]/route.ts` (unknown name returns 404); verify `download.test.ts` passes
- [x] 3.2 Add `apps/web/src/components/install-instructions.tsx` and `apps/web/src/app/install/page.tsx` with the content listed in design.md decision 4; add an "Install on your child's laptop" link to `/install` on the home page; adjust `vitest.config.ts` JSX setting only if needed; verify `install-instructions.test.ts` passes

## 4. Verify

- [x] 4.1 Update `docs/architecture.md` key flow 7 and the components table to say Edge uses `InPrivateModeAvailability` and that guest mode is disabled with `BrowserGuestModeEnabled`
- [ ] 4.2 Run `npm run check` and `npm run build` and fix all failures without weakening tests; manually download both files from `npm run dev:web` and check they open in a text editor with CRLF endings; check force-install on a real Edge install (Chrome Web Store update URL) and that a guest window cannot be opened
