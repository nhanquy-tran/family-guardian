## ADDED Requirements

### Requirement: Proxy applies the redirect rules
`proxy(request)` SHALL read the user with `supabase.auth.getUser()`, apply `authRedirect` to the request path, and return either the continuing response or a redirect to the target resolved against the request URL. Cookies set by the session refresh MUST be copied to a redirect response. A missing user or an auth error MUST count as signed out.

#### Scenario: Signed-out dashboard request redirects to login
- **GIVEN** `getUser` returns no user
- **WHEN** `proxy` handles `/dashboard/devices` (`apps/web/src/proxy.test.ts`)
- **THEN** the response is a redirect to `/login` on the request origin

#### Scenario: Signed-in login request redirects to the dashboard
- **GIVEN** `getUser` returns a user
- **WHEN** `proxy` handles `/login` (`apps/web/src/proxy.test.ts`)
- **THEN** the response is a redirect to `/dashboard`

#### Scenario: Signed-in dashboard request continues
- **GIVEN** `getUser` returns a user
- **WHEN** `proxy` handles `/dashboard` (`apps/web/src/proxy.test.ts`)
- **THEN** the response is not a redirect

#### Scenario: Refreshed cookies survive the redirect
- **GIVEN** `getUser` calls `setAll` with a session cookie and returns no user
- **WHEN** `proxy` handles `/dashboard` (`apps/web/src/proxy.test.ts`)
- **THEN** the redirect response carries that cookie

#### Scenario: Auth error counts as signed out
- **GIVEN** `getUser` returns `{ data: { user: null }, error }`
- **WHEN** `proxy` handles `/dashboard/children` (`apps/web/src/proxy.test.ts`)
- **THEN** the response redirects to `/login`

#### Scenario: Matcher covers only dashboard and login
- **WHEN** the exported `config.matcher` is read (`apps/web/src/proxy.test.ts`)
- **THEN** it equals `["/dashboard/:path*", "/login"]`
