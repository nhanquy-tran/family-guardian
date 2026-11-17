# Notes

## What changed
- `lib/auth/{redirects,flow}.ts`, `lib/family.ts`: pure logic taking a Supabase client as a parameter.
- `lib/supabase/{env,server}.ts` and `src/proxy.ts`: anon-key clients, session refresh, redirects with refreshed cookies copied; matcher `/dashboard/:path*` and `/login`.
- `/login` page with `LoginForm`; routes `POST /auth/sign-in`, `GET /auth/callback`, `POST /auth/sign-out` (303 redirects, no `next` param).
- `DashboardShell`, `dashboard/layout.tsx` (server-side `getUser` check) and placeholder Overview, Children, Devices, Install pages.
- Home page "coming soon" note replaced by a "Sign in" link.
- `apps/web/eslint.config.mjs`: turned off `react/no-children-prop` for `src/**/*.test.ts`, because the committed `dashboard-shell.test.ts` passes `children` through `createElement` props and failed lint. No test was edited.

## Verification
Every scenario is covered by the committed tests (59 pass in `npm run check`). `npm run build` passes. `docs/architecture.md` flow 1 needs no change.

## For the human
- Lint warning (not an error): unused `_table` in `family.test.ts`.
- `proposal.md` says issue #8, while the task says #7. Check which issue the PR should close.
- The live Google flow is untested. It needs the schema trigger and the Supabase and Google console setup. Disable the Supabase email provider.
