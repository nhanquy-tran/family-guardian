# Notes: add-windows-reg-installer (#17)

## What changed
- `apps/web/src/lib/installer/reg.ts`: `POLICY_TARGETS`, `buildSetupReg`, `buildRemoveReg` (CRLF, ASCII, uses `@fg/shared` constants).
- `apps/web/src/lib/installer/download.ts` and `app/install/[file]/route.ts`: `REG_FILES`, `regDownload`, `regFileResponse` (own-property lookup, 404 otherwise); public, no auth.
- `components/install-instructions.tsx`, `app/install/page.tsx`, home page link to `/install`.
- `docs/architecture.md`: components table now names `InPrivateModeAvailability` and `BrowserGuestModeEnabled` (flow 7 was already correct).
- No new dependencies, migrations or env vars; privacy (ADR 0005) unaffected.

## Verification
- Every scenario is covered by the committed tests (`reg.test.ts`, `download.test.ts`, `install-instructions.test.ts`), all unmodified and passing.
- `npm run check` and `npm run build` pass (5 pre-existing lint warnings in `heartbeat.test.ts`).

## For the human to check
- Task 4.2 manual steps are not done: download both files from `npm run dev:web`, confirm CRLF in an editor, and confirm on a real Windows machine that Edge force-installs via the Chrome Web Store update URL and that private and guest windows cannot be opened. The Web Store item must be published first (ADR 0009).
