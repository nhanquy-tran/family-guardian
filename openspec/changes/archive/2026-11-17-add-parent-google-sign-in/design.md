# Design

## Context

`apps/web` is a bare Next.js 16 App Router app (`layout.tsx`, `page.tsx`, `privacy/`). `@supabase/ssr` and `@supabase/supabase-js` are installed but unused. Next.js 16 renames middleware to **Proxy** (`src/proxy.ts`, exported `proxy` function, `config.matcher`; see `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`). Next's docs say Proxy is only an optimistic check, so the dashboard layout must also verify the user.

Vitest only picks up `apps/*/src/**/*.test.ts`. Pages and route handlers are thin; all logic sits in small `.ts` modules that take a Supabase client as a parameter, so tests pass a fake object. Requirements are in `specs/parent-auth/spec.md` and `specs/dashboard-shell/spec.md`.

## Goals / Non-Goals

**Goals:** Google-only sign-in, protected `/dashboard/*`, a shell other dashboard issues can fill in.

**Non-Goals:** schema or trigger (issue #7), page content, Playwright.

## Decisions

1. **Supabase clients.** `src/lib/supabase/server.ts` exports `createClient()` using `createServerClient` with `cookies()` from `next/headers` (`getAll` / `setAll`, ignoring the `setAll` error thrown in Server Components). `src/proxy.ts` builds its own client on the request/response cookies. Both use only the anon key. A missing env var throws an error naming the variable.

2. **Redirect rule as a pure function.** `src/lib/auth/redirects.ts`: `authRedirect(pathname, signedIn): string | null`. Signed out and path is `/dashboard` or starts with `/dashboard/` → `/login`. Signed in and path is `/login` → `/dashboard`. Otherwise `null`. `/dashboardx` is not protected. Proxy matcher: `["/dashboard/:path*", "/login"]`. Proxy calls `supabase.auth.getUser()` (refreshes the cookie), then `authRedirect`. When redirecting, it copies the refreshed cookies onto the redirect response.

3. **Sign-in via a POST form, not client JS.** `/login` is a Server Component rendering `<LoginForm error={...} />`: `<form method="post" action="/auth/sign-in"><button type="submit">Continue with Google</button></form>`. No client component needed, and the component renders with `renderToStaticMarkup` in a unit test. `src/lib/auth/flow.ts` holds:
   - `startGoogleSignIn(client, origin)` → calls `signInWithOAuth({ provider: "google", options: { redirectTo: origin + "/auth/callback" } })`; returns the provider URL, or `/login?error=auth` on error or missing URL.
   - `completeSignIn(client, code)` → `exchangeCodeForSession(code)`; returns `/dashboard` on success, `/login?error=auth` on missing code or error.
   - `signOut(client)` → `auth.signOut()`; returns `/login` (also on error, since the cookie is cleared anyway).
   Route handlers (`app/auth/sign-in/route.ts` POST, `app/auth/callback/route.ts` GET, `app/auth/sign-out/route.ts` POST) call these and return a `303` redirect. Origin comes from `request.nextUrl.origin`. No `next` parameter is accepted, so there is no open redirect.
   Alternative: client component calling `supabase.auth.signInWithOAuth` in the browser. Rejected: needs a browser client and is harder to unit test.

4. **Family name.** `src/lib/family.ts`: `getFamilyName(client)` runs `from("parents").select("families(name)").maybeSingle()`; RLS limits it to the signed-in parent. Returns the name, or `"My family"` if there is no row, the name is empty, or the query errors. The web app never writes `families` or `parents`.

5. **Shell components.** `src/components/dashboard-shell.tsx` exports `DASHBOARD_NAV` (`Overview /dashboard`, `Children /dashboard/children`, `Devices /dashboard/devices`, `Install /dashboard/install`) and `DashboardShell({ familyName, children })`: header with the family name and a `<form method="post" action="/auth/sign-out">` "Sign out" button, then a `<nav>` of `next/link` links. `app/dashboard/layout.tsx` calls `getUser()`, `redirect("/login")` if none, else `getFamilyName` and renders the shell. Placeholder pages show a heading only.

6. **No-password guard.** `src/lib/auth/no-password.test.ts` reads every `.ts`/`.tsx` file under `apps/web/src` (excluding `*.test.ts`) and fails on `signInWithPassword`, `signUp(`, `signInWithOtp`, `resetPasswordForEmail`, `type="password"` or `type="email"`.

7. **JSX in tests.** Component tests are `.test.ts` and use `createElement`. If Vitest cannot transform the imported `.tsx` (web tsconfig uses `jsx: preserve`), set `oxc`/`esbuild` `jsx: "automatic"` in the root `vitest.config.ts`. `next/link` renders as `<a>` in `renderToStaticMarkup`.

## Risks / Trade-offs

- [Issue #7 not merged yet] → Unit tests use fakes; the human verifies the live flow after both are deployed.
- [Proxy runs on every dashboard request] → One `getUser()` call; fine for 20 families.
- [Supabase email provider still enabled in the console] → Human setup step 3.3 disables it; the UI exposes no email path either way.
