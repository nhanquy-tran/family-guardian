# Proposal

Implements GitHub issue #8 ("Parent sign-in with Google and dashboard shell").

## Why

Parents have no way to sign in yet, so no dashboard feature (children, pairing, devices, installer) can be built. ADR 0004 fixes Google as the only sign-in method.

## What Changes

- `/login` page with a single "Continue with Google" button, using Supabase Auth through `@supabase/ssr` (already a dependency).
- Route handlers: `POST /auth/sign-in` (starts the Google OAuth flow), `GET /auth/callback` (exchanges the code for a session cookie), `POST /auth/sign-out`.
- `src/proxy.ts` (Next.js 16 name for middleware): refreshes the session cookie, redirects signed-out visitors of `/dashboard` and `/dashboard/*` to `/login`, and signed-in visitors of `/login` to `/dashboard`. The dashboard layout checks the user again on the server.
- Dashboard shell at `/dashboard`: header with the family name and a sign-out button; nav with Overview, Children, Devices, Install. Children, Devices and Install are placeholder pages.
- The family name is read through RLS from the `parents` and `families` rows that the schema trigger (issue #7) creates on first sign-in. The web app never inserts the family itself.
- Home page "coming soon" note replaced by a "Sign in" link to `/login`.
- A test that fails if any e-mail/password or magic-link auth call or password field appears in `apps/web/src`.

## Capabilities

### New Capabilities

- `parent-auth`: Google-only sign-in, callback, sign-out and route protection.
- `dashboard-shell`: the signed-in layout (family name, sign-out, nav).

### Modified Capabilities

None.

## Impact

- New files under `apps/web/src/` (`proxy.ts`, `lib/supabase/`, `lib/auth/`, `components/`, `app/login/`, `app/auth/`, `app/dashboard/`). No new dependencies; may add a JSX setting to `vitest.config.ts` so components render in unit tests.
- Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already in `.env.example`). No service-role key.
- Depends on issue #7 (schema, RLS and the first-sign-in trigger) to be merged before it works end to end; unit tests use fake Supabase clients and do not need it.
- No data collected from children; ADR 0005 is unaffected.

## Out of scope

- The schema, RLS policies and the trigger that creates the family and parent rows (issue #7).
- Content of Overview, Children, Devices and Install pages (later issues).
- Renaming the family, inviting a second parent, account deletion.
- Playwright end-to-end tests against real Google sign-in.
- Supabase/Google console settings (done by the human in issue #1).
