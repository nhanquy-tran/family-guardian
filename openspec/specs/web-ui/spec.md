# web-ui Specification

## Purpose
Give the parent web app a consistent, mobile-friendly look: generated Tailwind CSS, a centered login card, a dashboard shell with header and wrapping navigation, and shared heading, button and card styles.

## Requirements

### Requirement: Tailwind generates CSS

The web app SHALL process Tailwind so utility classes used in components produce CSS in dev and production builds.

#### Scenario: Tailwind is wired
- **GIVEN** the `apps/web` configuration files
- **WHEN** `apps/web/src/styles-wiring.test.ts` reads `next.config.ts`, `postcss.config.mjs` (if present), `package.json` and `src/app/globals.css`
- **THEN** exactly one Tailwind integration is configured (turbopack loader in `next.config.ts`, or the `@tailwindcss/postcss` plugin in `postcss.config.mjs` with that package in `apps/web` `devDependencies`) and `globals.css` imports `tailwindcss`

#### Scenario: Build emits the classes
- **GIVEN** `npm run build` has run
- **WHEN** `apps/web/src/styles-wiring.test.ts` scans the built CSS under `apps/web/.next/static` (the test is skipped when `.next` is absent)
- **THEN** the CSS contains the rules for `rounded-lg` and `max-w-sm`

### Requirement: Styled login page

The login page SHALL show a centered card with the app name, one full-width Google button and a styled error alert.

#### Scenario: Card layout
- **GIVEN** the login form without an error
- **WHEN** `LoginForm` is rendered in `apps/web/src/components/login-form.test.ts`
- **THEN** the markup contains the shared card class, exactly one button with the `w-full` and `min-h-10` classes, and the form still has `method="post"` and `action="/auth/sign-in"`

#### Scenario: Error alert
- **GIVEN** the error is `auth`
- **WHEN** `LoginForm` is rendered in `login-form.test.ts`
- **THEN** an element with `role="alert"` contains "Sign-in failed. Please try again." and has red text and background classes

### Requirement: Styled dashboard shell

The dashboard shell SHALL show a header with the family name and Sign out, a horizontal nav and a padded, width-limited container.

#### Scenario: Header
- **GIVEN** family name "Tran family"
- **WHEN** `DashboardShell` is rendered in `apps/web/src/components/dashboard-shell.test.ts`
- **THEN** the `<header>` has `flex` and `items-center` classes, contains the family name and the Sign out form (`action="/auth/sign-out"`, `method="post"`), and the button has `min-h-10`

#### Scenario: Nav is horizontal and wraps
- **GIVEN** the shell markup
- **WHEN** rendered in `dashboard-shell.test.ts`
- **THEN** `<nav>` has `flex` and `flex-wrap`, each link has a padding class, and the hrefs and their order are unchanged

#### Scenario: Page container
- **GIVEN** the shell markup
- **WHEN** rendered in `dashboard-shell.test.ts`
- **THEN** the wrapper has `mx-auto`, `max-w-4xl`, `p-4` and `sm:p-6`, and `<main>` contains the children

### Requirement: Mobile friendly at 375 px

The login page and shell SHALL NOT use fixed widths or non-wrapping rows.

#### Scenario: No fixed widths
- **GIVEN** the rendered login form and dashboard shell and the constants exported by `ui.ts`
- **WHEN** `apps/web/src/components/ui.test.ts` inspects them
- **THEN** none contains a fixed width class (`w-[`, `min-w-[`) or `whitespace-nowrap`, and the unprefixed container padding is `p-4`

### Requirement: Behaviour unchanged

Styling SHALL NOT change routes, copy, nav items or form actions.

#### Scenario: Existing contracts hold
- **GIVEN** the existing tests for the login form, shell and auth
- **WHEN** `npm run check` runs
- **THEN** the assertions already in `login-form.test.ts` and `dashboard-shell.test.ts` and all of `no-password.test.ts` pass unmodified
