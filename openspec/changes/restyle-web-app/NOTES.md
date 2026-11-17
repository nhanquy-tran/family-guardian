# Notes: restyle-web-app (#65)

## Test concerns

`npm run check` has 2 failing tests that I cannot fix in code without working around them. Stopped here as instructed.

1. **`styles-wiring.test.ts` › "icon files match the design source" needs `apps/web/src/app/favicon.ico` deleted.** The file still exists, and this environment denied every shell `rm` (and `git rm`) on it. No edit tool can delete a file. All the other assertions in that test pass (both `icon.svg` copies are byte-identical to `docs/design/icon.svg`). Fix: `git rm apps/web/src/app/favicon.ico`. This is an environment limitation, not a test problem.
2. **`design-adoption.test.ts` › "pages and views use ui.ts" cannot be satisfied for four pages without a workaround.**
   - `app/dashboard/children/page.tsx`, `.../children/[childId]/rules/page.tsx` and `.../homework/page.tsx` only render `ChildrenList`, `BlockRulesView` and `HomeworkSettingsView`. Those views already import from `ui.ts`. The pages have no markup of their own, so the only way to import and "use" a `ui` export would be a gratuitous import or wrapper element.
   - `app/privacy/page.tsx` is imported directly by `app/privacy/page.test.tsx`, and vitest has no `@/` alias (`vitest.config.ts`), so it must import with the relative `../../components/ui`. The test's import regex accepts only `./ui`, `@/components/ui` and `../components/ui`, so it rejects that path. The same regex also rejects `../../components/ui`, which is what `app/dashboard/*` pages would use, so those pages use `@/components/ui` instead and pass.
   - Suggested resolution for the debugger: drop the three view-only pages from the list (they are covered through their views), and accept `(?:\.\./)+components/ui` in the regex, or add the `@` alias to `vitest.config.ts`.
   - Every other file in that list passes (checked by hand: the login, dashboard, devices, usage, install and settings pages and the seven components).

All other tests pass (537 of 539 after this change, plus the 1 skipped build-CSS test).

## Not done yet

- 4.1: `npm run check` is not fully green (see above) and I did not run `npm run build`.
- 4.2: the manual Vercel preview check (light and dark, desktop and 375px) is for a human.

## Deviations and decisions

- `DashboardShell` header `<img>` has `loading="lazy"`. React 19 otherwise emits a `<link rel="preload" as="image">` ahead of the first `<div>` in static markup, which breaks the "container is the first element" assertion in `dashboard-shell.test.ts`. Browsers still load an in-viewport lazy image at once.
- Inter is loaded with `variable: "--font-inter"`, and `globals.css` overrides `--font` after the tokens import to `var(--font-inter), "Inter", ...`. `next/font` gives Inter a hashed family name, so the token's plain `"Inter"` would never match the loaded font. `tokens.css` stays byte-identical to the design source.
- `navLinkCurrent` is a complete class string (shape, padding, colours, ring), and the nav uses it instead of `navLink` for the current link. Combining the two would leave `text-ink-2` and `text-accent-ink` competing in the CSS.
- `container` uses `max-w-screen-2xl` (not `max-w-[1500px]`) because the no-fixed-widths test bans `w-[`.
- The offline banner has lost its old `mb-4` spacing, because the test pins the element to `className={alertWarning}` exactly.
- Chart and category colours in `lib/usage` (`CATEGORY_COLORS`, hex) are unchanged: charts redesign is out of scope.

## Docs to update

- `docs/design/style-guide.md`: status pill text colour. Pills use `ink` text with a soft background, not the strong colour as text, because `--red` on `--red-soft` is 3.60:1.
- `docs/design/style-guide.md` / `tokens.css`: failing light-mode pairs `--red` on `--card` (4.34:1), `--red` on `--red-soft` (3.60:1) and `--muted` on `--card` (4.25:1). Reserve `--muted` for placeholders and disabled text, or darken the tokens.
- `apps/web/CLAUDE.md`: `src/styles/tokens.css` is a copy of `docs/design/tokens.css` kept identical by `styles-wiring.test.ts`; copy it again whenever the design tokens change. Also mention `ui.ts` as the only place for class strings (no palette colours, no `dark:`).

## Debugging

1. **`styles-wiring.test.ts` > icon files match the design source**
   - Root cause: `apps/web/src/app/favicon.ico` still exists; the scenario requires it gone.
   - Verdict: code (leftover file). The test is right.
   - Change: none made. `git rm apps/web/src/app/favicon.ico` was denied by the environment and I did not work around it. A human or the workflow must run it.

2. **`design-adoption.test.ts` > pages and views use ui.ts**
   - Root cause A (privacy page): the import regex accepted only `../components/ui`, but the scenario says `components/ui`, and `app/privacy/page.tsx` must use `../../components/ui` (no `@/` alias in vitest).
   - Verdict A: test. Change: the regex now accepts `(?:\.\.\/)+components\/ui`. Nothing removed.
   - Root cause B: `dashboard/children/page.tsx`, `.../[childId]/rules/page.tsx` and `.../[childId]/homework/page.tsx` render only a view component and have no markup, so they import nothing from `ui`. The scenario lists them, while the requirement text covers pages "that render markup".
   - Verdict B: spec unclear, nothing changed. Question for the owner: drop the three view-only pages from the scenario list (covered through their views), or must each page use a `ui` export? Dropping them from the test would be loosening, so I did not. This test still fails on `app/dashboard/children/page.tsx` until answered.

## Summary

Tokens copied to `src/styles/tokens.css` and mapped in `globals.css` (`@theme inline`); Inter via `next/font/google`; icon copied to `src/app/icon.svg` and `public/icon.svg`; `ui.ts` rewritten with all 20 constants; new client `dashboard-nav.tsx` (`usePathname`, `currentPath` override, `aria-current="page"`); `DashboardShell`, login page and form, offline banner and all dashboard pages and views restyled with `ui.ts` and tokens only. No data, routes, copy or form actions changed.

Scenario to test: `styles-wiring`, `ui`, `login-form`, `dashboard-shell`, `design-adoption` and `contrast` tests, all passing except the two concerns above.
