Depends on: none
Touches: web-ui, dashboard-shell, apps/web/src/components/ui.ts

# Restyle the parent web app with the Family Guardian style guide (#65)

## Why
The parent app still uses default Tailwind neutrals and Geist. `docs/design/` (merged in #64) defines the shared look: soft grey-blue ground, white rounded cards, pill buttons, Inter, brand blue, light and dark mode.

## What changes
- Load the design tokens in `globals.css` (copy under `apps/web/src/styles/tokens.css`, kept identical to `docs/design/tokens.css` by a test) and map them in Tailwind 4 `@theme inline`.
- Inter via `next/font/google`; body uses `--font` and `--ground`.
- `ui.ts` becomes the single source of class strings: container, card, page title, buttons (primary, secondary, danger), input, status pills, table, nav link, alerts. Screens use them; no `neutral-*`, Tailwind palette colours or hex values remain in components.
- Login: centred card with icon, wordmark and Google pill button.
- Dashboard shell: sticky nav bar with icon, wordmark, pill nav links (current page `--accent-soft`), family name, Settings, Sign out.
- `icon.svg` is the favicon, nav icon and login icon.
- Offline banner and error states use soft status colours.

## Out of scope
- Any change to data, API, routes, copy, nav items, form actions or privacy behaviour (ADR 0005 unaffected).
- Manual theme switch (`data-theme`): the app follows the system only.
- Editing `docs/design/` (tokens, guide, icon). Contrast problems found in the tokens go to NOTES.md.
- New dependencies (only `next/font`, part of Next).
- Charts redesign beyond using the token colours.

## Impact
`apps/web` only. Existing tests that assert old class names (`rounded-lg`, `max-w-4xl`, `min-h-10`, `text-red-*`, `bg-red-*`) are replaced by the scenarios in the delta specs. The Vercel preview check (light and dark, desktop and 375px) is a manual task.
