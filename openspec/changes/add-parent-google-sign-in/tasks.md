# Tasks

## 1. Tests first

- [ ] 1.1 Write `apps/web/src/lib/auth/redirects.test.ts`, `flow.test.ts`, `no-password.test.ts`, `apps/web/src/lib/family.test.ts`, `apps/web/src/components/login-form.test.ts` and `dashboard-shell.test.ts` with one test per scenario in `specs/parent-auth/spec.md` and `specs/dashboard-shell/spec.md`, using fake Supabase clients and `renderToStaticMarkup`; verify they fail only because the modules do not exist yet

## 2. Auth logic

- [ ] 2.1 Add `src/lib/auth/redirects.ts` (`authRedirect`); verify `redirects.test.ts` passes
- [ ] 2.2 Add `src/lib/auth/flow.ts` (`startGoogleSignIn`, `completeSignIn`, `signOut`) typed against the Supabase auth client; verify `flow.test.ts` passes
- [ ] 2.3 Add `src/lib/supabase/server.ts` and `src/proxy.ts` (session refresh, `authRedirect`, cookies copied onto redirects, matcher `/dashboard/:path*` and `/login`) per design.md

## 3. Pages and routes

- [ ] 3.1 Add `src/components/login-form.tsx`, `src/app/login/page.tsx` and route handlers `src/app/auth/sign-in/route.ts`, `auth/callback/route.ts`, `auth/sign-out/route.ts` (303 redirects); adjust `vitest.config.ts` JSX setting only if needed; verify `login-form.test.ts` passes
- [ ] 3.2 Add `src/lib/family.ts` (`getFamilyName`), `src/components/dashboard-shell.tsx` (`DASHBOARD_NAV`, `DashboardShell`), `src/app/dashboard/layout.tsx` (server-side `getUser` check) and placeholder pages for Overview, Children, Devices, Install; verify `family.test.ts` and `dashboard-shell.test.ts` pass
- [ ] 3.3 Replace the "coming soon" note on the home page with a "Sign in" link to `/login`; verify `no-password.test.ts` passes

## 4. Verify

- [ ] 4.1 Update `docs/architecture.md` key flow 1 if the sign-in routes differ from it
- [ ] 4.2 Run `npm run check` and `npm run build` and fix all failures without weakening tests
