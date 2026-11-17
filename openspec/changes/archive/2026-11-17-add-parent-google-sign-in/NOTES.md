# Implementation notes

## What changed

- `lib/auth/redirects.ts`, `lib/auth/flow.ts`, `lib/family.ts`: pure logic taking a Supabase client as a parameter.
- `lib/supabase/env.ts` (names the missing env var) and `lib/supabase/server.ts` (anon key only, cookie-based `@supabase/ssr` client).
- `src/proxy.ts`: refreshes the session, applies `authRedirect` to `/dashboard/:path*` and `/login`, copies refreshed cookies onto redirects.
- Routes: `POST /auth/sign-in`, `GET /auth/callback`, `POST /auth/sign-out` (all 303; no `next` parameter).
- `/login` page + `LoginForm`; `DashboardShell`, `DASHBOARD_NAV`, `app/dashboard/layout.tsx` (re-checks the user server-side) and placeholder Overview/Children/Devices/Install pages.
- Home page "coming soon" note replaced by a "Sign in" link.
- `docs/architecture.md` key flow 1 still matches the implementation; no change needed.

## Scenario verification

All scenarios are covered by the test-writer's unit tests (`redirects.test.ts`, `flow.test.ts`, `login-form.test.ts`, `no-password.test.ts`, `family.test.ts`, `dashboard-shell.test.ts`). `npm run check` passes (110 tests). `npm run build` passes (without Supabase env vars set).

## For the human to check

- `DashboardShell` has `children` typed as optional: the committed test renders it with `createElement(DashboardShell, { familyName })` plus children as the third argument, which TypeScript rejects when `children` is required. Tests were not edited.
- `createClient()` calls `cookies()` before reading env vars so dashboard routes are always dynamic; otherwise the build prerendered them and failed without Supabase env vars. Production needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set at runtime.
- The live Google flow was not exercised; it needs issue #7 (schema and first-sign-in trigger), the Google provider configured in Supabase, and `<origin>/auth/callback` in the allowed redirect URLs.
- The build prints a pre-existing Turbopack warning about `@theme` in `globals.css`; it does not fail the build.
