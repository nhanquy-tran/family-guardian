# Spec Delta

## Purpose

Parents sign in with Google only (ADR 0004) and only signed-in parents reach the dashboard.

Test files:
- `apps/web/src/lib/auth/redirects.test.ts`
- `apps/web/src/lib/auth/flow.test.ts`
- `apps/web/src/components/login-form.test.ts`
- `apps/web/src/lib/auth/no-password.test.ts`

## ADDED Requirements

### Requirement: Login page with a single Google button
The `/login` page SHALL show exactly one sign-in control, a submit button labelled "Continue with Google" in a form that posts to `/auth/sign-in`. When the page has `?error=auth` it SHALL also show "Sign-in failed. Please try again.".

#### Scenario: Login form renders one Google button
- **WHEN** a test renders `LoginForm` without an error (`login-form.test.ts`)
- **THEN** the markup contains exactly one `<button`, its text is "Continue with Google"
- **AND** the form has `method="post"` and `action="/auth/sign-in"`
- **AND** the markup contains no `<input`

#### Scenario: Login form shows the error message
- **WHEN** a test renders `LoginForm` with `error` set (`login-form.test.ts`)
- **THEN** the markup contains "Sign-in failed. Please try again."

### Requirement: Start Google OAuth
`startGoogleSignIn(client, origin)` SHALL call Supabase `signInWithOAuth` with provider `google` and `redirectTo` equal to `<origin>/auth/callback`, and return the provider URL. On an error or a missing URL it SHALL return `/login?error=auth`.

#### Scenario: Provider URL returned
- **GIVEN** a fake client whose `signInWithOAuth` resolves `{ data: { url: "https://accounts.example/o" }, error: null }`
- **WHEN** `startGoogleSignIn(client, "https://fg.test")` is called (`flow.test.ts`)
- **THEN** `signInWithOAuth` was called once with `{ provider: "google", options: { redirectTo: "https://fg.test/auth/callback" } }`
- **AND** the result is `"https://accounts.example/o"`

#### Scenario: OAuth start fails
- **GIVEN** a fake client whose `signInWithOAuth` resolves with a non-null `error`, or with `url: null`
- **WHEN** `startGoogleSignIn` is called (`flow.test.ts`)
- **THEN** the result is `"/login?error=auth"`

### Requirement: OAuth callback creates the session
`completeSignIn(client, code)` SHALL exchange the code for a session and return `/dashboard`. With a missing code or an exchange error it SHALL return `/login?error=auth` without throwing. It SHALL NOT accept a caller-supplied redirect target.

#### Scenario: Valid code
- **GIVEN** a fake client whose `exchangeCodeForSession` resolves `{ error: null }`
- **WHEN** `completeSignIn(client, "abc")` is called (`flow.test.ts`)
- **THEN** `exchangeCodeForSession` was called with `"abc"` and the result is `"/dashboard"`

#### Scenario: Missing code
- **WHEN** `completeSignIn(client, null)` is called (`flow.test.ts`)
- **THEN** the result is `"/login?error=auth"` and `exchangeCodeForSession` was not called

#### Scenario: Exchange error
- **GIVEN** a fake client whose `exchangeCodeForSession` resolves with a non-null `error`
- **WHEN** `completeSignIn(client, "bad")` is called (`flow.test.ts`)
- **THEN** the result is `"/login?error=auth"`

### Requirement: Sign out
`signOut(client)` SHALL call Supabase `auth.signOut()` and return `/login`, also when sign-out reports an error.

#### Scenario: Sign out returns to login
- **GIVEN** a fake client whose `signOut` resolves `{ error: null }` (and, in a second case, a non-null `error`)
- **WHEN** `signOut(client)` is called (`flow.test.ts`)
- **THEN** `auth.signOut` was called once and the result is `"/login"` in both cases

### Requirement: Dashboard routes require a signed-in parent
`authRedirect(pathname, signedIn)` SHALL return `/login` for a signed-out request to `/dashboard` or any path under `/dashboard/`, `/dashboard` for a signed-in request to `/login`, and `null` otherwise. The proxy SHALL apply it to `/dashboard/:path*` and `/login`.

#### Scenario: Signed-out user visits the dashboard
- **WHEN** `authRedirect` is called with (`/dashboard`, false), (`/dashboard/devices`, false) and (`/dashboard/children/123`, false) (`redirects.test.ts`)
- **THEN** each returns `"/login"`

#### Scenario: Signed-in user visits the dashboard
- **WHEN** `authRedirect("/dashboard/devices", true)` is called (`redirects.test.ts`)
- **THEN** it returns `null`

#### Scenario: Signed-in user visits login
- **WHEN** `authRedirect("/login", true)` is called (`redirects.test.ts`)
- **THEN** it returns `"/dashboard"`

#### Scenario: Public pages are not redirected
- **WHEN** `authRedirect` is called with (`/login`, false), (`/`, false), (`/privacy`, false) and (`/dashboardx`, false) (`redirects.test.ts`)
- **THEN** each returns `null`

### Requirement: No e-mail or password authentication
The web app source SHALL contain no e-mail/password, magic-link or password-reset auth path (ADR 0004).

#### Scenario: Source scan finds no password auth
- **WHEN** a test reads every `.ts` and `.tsx` file under `apps/web/src` except test files (`no-password.test.ts`)
- **THEN** none contains `signInWithPassword`, `signUp(`, `signInWithOtp`, `resetPasswordForEmail`, `type="password"` or `type="email"`
