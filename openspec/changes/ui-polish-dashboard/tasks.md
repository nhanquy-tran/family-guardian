# Tasks

Prerequisite: change `add-parent-google-sign-in` (#8) is merged (on `main`).

## 1. Tests first

- [ ] 1.1 Write `apps/web/src/styles-wiring.test.ts` and `apps/web/src/components/ui.test.ts`, and extend `login-form.test.ts` and `dashboard-shell.test.ts` (keep existing assertions), one test per scenario in `specs/web-ui/spec.md`; verify they fail only because the styling and wiring are missing

## 2. Tailwind wiring

- [ ] 2.1 Wire Tailwind per design.md decision 1 (check `node_modules/next/dist/docs/`); verify `styles-wiring.test.ts` passes and `npm run build` emits CSS containing `rounded-lg`

## 3. Components

- [ ] 3.1 Add `apps/web/src/components/ui.ts` style constants; verify `ui.test.ts` passes
- [ ] 3.2 Style `login-form.tsx` and `app/login/page.tsx`; verify `login-form.test.ts` passes
- [ ] 3.3 Style `dashboard-shell.tsx` and apply `pageTitle` to the headings of the existing dashboard pages; verify `dashboard-shell.test.ts` passes

## 4. Verify

- [ ] 4.1 Run `npm run check` and `npm run build` and fix all failures without weakening tests; check the Vercel preview at 375 px width and note the result in the PR
