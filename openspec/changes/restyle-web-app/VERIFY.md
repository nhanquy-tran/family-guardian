VERIFY: PASS

## Verification Report: restyle-web-app

| Dimension | Status |
|---|---|
| Completeness | 8/9 tasks ticked. The only open one, 4.2, is marked manual in NOTES.md. All 12 requirements have code and tests. |
| Correctness | 12/12 requirements covered, 0 scenarios uncovered, by reading code and tests. `npm run check` was not re-run (see Not verified). |
| Coherence | Design decisions followed. No contradiction with `openspec/specs/` or the ADRs. |

### CRITICAL
None.

### WARNING
- `tasks.md:4.2` (manual Vercel preview check, light and dark, desktop and 375px) is unticked. NOTES.md ("Not done: task 4.2") explicitly marks it manual, so it is not critical. A human must do it before merge.

### SUGGESTION
- `apps/web/src/components/dashboard-shell.tsx:20`: the shell icon uses `loading="lazy"` only to work around a test constraint (`^<div`). This is documented in NOTES.md. Revisit if the test is ever relaxed.
- `apps/web/src/components/ui.ts:24`: `table` is only `w-full overflow-x-auto`. Check at 375px in the manual task 4.2.

### Evidence
- **Tailwind, tokens, Inter, icons**
  - `apps/web/src/styles/tokens.css`, `apps/web/public/icon.svg` and `apps/web/src/app/icon.svg` are byte-identical to the `docs/design/` sources (`cmp` clean).
  - `favicon.ico` is deleted.
  - Tests are in `styles-wiring.test.ts`.
- **ui.ts**
  - All 20 constants are exported (`apps/web/src/components/ui.ts`).
  - They use token classes only.
  - `buttonDanger` uses `text-ink` + `border-red`.
  - There is no `text-red/amber/green/muted` except `placeholder:text-muted`.
  - Focus rings use `accent-soft`.
  - `table` has `overflow-x-auto`.
  - No fixed widths.
  - Container padding is `p-4`.
- **Shell**
  - `dashboard-nav.tsx` is a client component calling `usePathname`.
  - The `currentPath` override is optional.
  - The dashboard layout passes none (`apps/web/src/app/dashboard/layout.tsx`).
  - `aria-current` and sub-path matching are implemented as in the spec.
  - The header is sticky and flex, with brand icon, family name and a sign-out form (`action="/auth/sign-out"`).
  - Nav hrefs and order are unchanged.
- **Adoption**
  - A grep of `apps/web/src/app` and `apps/web/src/components` (non-test files) for `neutral-\d`, hex colours and `dark:` found no matches.
  - `design-adoption.test.ts` covers the ui.ts imports.
  - `contrast.test.ts` covers the contrast pairs.
- **Behaviour unchanged**: the diff touches only `apps/web` styling plus the change folder. There is no API, route or data change, so ADR 0005 is unaffected.

### Not verified
- `npm run check` and `npm run build` could not be run in this session (command approval was not granted). NOTES.md reports check at 542 pass, 1 skipped, and build passing. The orchestrator's verify gate should confirm both.

### Final assessment
No critical issues. 1 warning (manual task 4.2) and 2 suggestions. `npm run check` and `npm run build` were not re-run by this verifier; the gate should confirm them.
