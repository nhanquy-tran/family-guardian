# Proposal

Implements GitHub issue #40 ("UI polish: style login, dashboard shell and pages").

## Why

Pages from #8 render as plain HTML. `globals.css` imports Tailwind, but no build step processes it: `apps/web` has no `postcss.config.*`, no `@tailwindcss/postcss`, and `next.config.ts` does not wire `@tailwindcss/turbopack`, so utility classes produce no CSS. Parents see an unstyled login, header and nav.

## What Changes

- Make Tailwind generate CSS in dev, build and Vercel (see design.md decision 1).
- Login: centered card with the app name and a full-width Google button; the error message styled as an alert.
- Dashboard shell: header with family name and a Sign out button, horizontal nav that wraps at 375 px, a page container with consistent padding and max width.
- Shared look for headings, buttons and cards via a few Tailwind class constants in one module, applied to the login and shell and to the existing pages' headings.
- Mobile friendly at 375 px: no horizontal page scroll, tap targets at least 40 px high.
- Existing markup contracts stay: one Google button posting to `/auth/sign-in`, sign-out form posting to `/auth/sign-out`, nav links and order unchanged.

## Capabilities

### New Capabilities

- `web-ui`: shared visual style of the login page and dashboard shell.

### Modified Capabilities

None.

## Impact

- `apps/web`: `login-form.tsx`, `app/login/page.tsx`, `dashboard-shell.tsx`, page headings under `app/dashboard/`, Tailwind wiring (`next.config.ts` or `postcss.config.mjs`).
- No new data collected or stored, no API or database change, so no ADR is needed.
- No new runtime dependency. Only if `@tailwindcss/turbopack` cannot be wired, one devDependency `@tailwindcss/postcss` at the same version as `tailwindcss` (4.3.3), stated in the PR.
- Depends on #8 (login, shell), already on `main`. Nothing else must merge first.

## Out of scope

- Dark mode redesign, logo, icons, animations, a component library.
- Changing copy, routes, nav items, auth flow or any behaviour.
- Restyling charts and tables inside the usage view beyond headings.
- Visual regression or browser screenshot tests.
