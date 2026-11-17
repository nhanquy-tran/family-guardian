## MODIFIED Requirements

### Requirement: Tailwind generates CSS

The web app SHALL process Tailwind so utility classes used in components produce CSS in dev and production builds, and SHALL load the Family Guardian design tokens and map them into Tailwind.

#### Scenario: Tailwind is wired
- **GIVEN** the `apps/web` configuration files
- **WHEN** `apps/web/src/styles-wiring.test.ts` reads `next.config.ts`, `postcss.config.mjs` (if present), `package.json` and `src/app/globals.css`
- **THEN** exactly one Tailwind integration is configured (turbopack loader in `next.config.ts`, or the `@tailwindcss/postcss` plugin in `postcss.config.mjs` with that package in `apps/web` `devDependencies`) and `globals.css` imports `tailwindcss`

#### Scenario: Build emits the classes
- **GIVEN** `npm run build` has run
- **WHEN** `apps/web/src/styles-wiring.test.ts` scans the built CSS under `apps/web/.next/static` (the test is skipped when `.next` is absent)
- **THEN** the CSS contains the rules for `bg-card`, `rounded-card` and `rounded-pill`

#### Scenario: Tokens are loaded and mapped
- **GIVEN** `apps/web/src/app/globals.css` and `apps/web/src/styles/tokens.css`
- **WHEN** `styles-wiring.test.ts` reads them
- **THEN** `globals.css` imports the tokens file, its `@theme inline` block maps `--color-ground`, `--color-card`, `--color-ink`, `--color-accent`, `--color-red`, `--radius-card`, `--shadow-card` and `--font-sans` to the matching `var(--…)` tokens, and `body` uses `background: var(--ground)` and `font-family: var(--font)`

#### Scenario: Token copy equals the design source
- **GIVEN** `docs/design/tokens.css`
- **WHEN** `styles-wiring.test.ts` compares it with `apps/web/src/styles/tokens.css`
- **THEN** the contents are identical

#### Scenario: Inter replaces Geist
- **GIVEN** `apps/web/src/app/layout.tsx`
- **WHEN** `styles-wiring.test.ts` reads it
- **THEN** it imports `Inter` from `next/font/google` and does not import `Geist` or `Geist_Mono`

### Requirement: Styled login page

The login page SHALL show a centred card with the app icon, the wordmark "Family Guardian" and one full-width Google sign-in pill button as the primary button, and a styled error alert using soft status colours.

#### Scenario: Card layout
- **GIVEN** the login form without an error
- **WHEN** `LoginForm` is rendered in `apps/web/src/components/login-form.test.ts`
- **THEN** the markup contains the shared `card` class, an `<img` with `src="/icon.svg"`, the text "Family Guardian", exactly one button with the `buttonPrimary` classes plus `w-full`, and the form still has `method="post"` and `action="/auth/sign-in"`

#### Scenario: Error alert
- **GIVEN** the error is `auth`
- **WHEN** `LoginForm` is rendered in `login-form.test.ts`
- **THEN** an element with `role="alert"` contains "Sign-in failed. Please try again." and has the shared `alertError` classes

### Requirement: Styled dashboard shell

The dashboard shell SHALL show a sticky nav bar with the app icon and wordmark, pill nav links (the current page marked with `aria-current="page"` and the accent-soft style), the family name, Settings and Sign out, above a padded, width-limited container.

#### Scenario: Header
- **GIVEN** family name "Tran family"
- **WHEN** `DashboardShell` is rendered in `apps/web/src/components/dashboard-shell.test.ts`
- **THEN** the `<header>` has `sticky` and `flex` classes, contains an `<img` with `src="/icon.svg"`, "Family Guardian", the family name and the Sign out form (`action="/auth/sign-out"`, `method="post"`), and the Sign out button has the `buttonSecondary` classes

#### Scenario: Nav is horizontal and wraps
- **GIVEN** the shell markup
- **WHEN** rendered in `dashboard-shell.test.ts`
- **THEN** `<nav>` has `flex` and `flex-wrap`, each link has the `navLink` classes, and the hrefs and their order are unchanged

#### Scenario: Current page is highlighted
- **GIVEN** `DashboardShell` rendered with `currentPath` `/dashboard/devices`
- **WHEN** rendered in `dashboard-shell.test.ts`
- **THEN** only the Devices link has `aria-current="page"` and the `navLinkCurrent` classes

#### Scenario: No current page
- **GIVEN** `DashboardShell` rendered without `currentPath`
- **WHEN** rendered in `dashboard-shell.test.ts`
- **THEN** no link has `aria-current`

#### Scenario: Page container
- **GIVEN** the shell markup
- **WHEN** rendered in `dashboard-shell.test.ts`
- **THEN** the content wrapper has the shared `container` classes and `<main>` contains the children

### Requirement: Mobile friendly at 375 px

The login page, shell and shared class strings SHALL NOT use fixed widths or non-wrapping rows, and all controls SHALL have a visible focus ring.

#### Scenario: No fixed widths
- **GIVEN** the rendered login form and dashboard shell and the constants exported by `ui.ts`
- **WHEN** `apps/web/src/components/ui.test.ts` inspects them
- **THEN** none contains a fixed width class (`w-[`, `min-w-[`) or `whitespace-nowrap`, and the unprefixed container padding is `p-4`

#### Scenario: Focus is visible
- **GIVEN** `buttonPrimary`, `buttonSecondary`, `buttonDanger`, `input` and `navLink`
- **WHEN** `ui.test.ts` inspects them
- **THEN** each contains a `focus-visible:` or `focus:` ring class using `accent-soft`

#### Scenario: Wide tables scroll inside their card
- **GIVEN** the `table` wrapper class exported by `ui.ts`
- **WHEN** `ui.test.ts` inspects it
- **THEN** it contains `overflow-x-auto`

### Requirement: Behaviour unchanged

Styling SHALL NOT change routes, copy, nav items, form actions, data, API or privacy behaviour.

#### Scenario: Existing contracts hold
- **GIVEN** the existing tests for the login form, shell and auth
- **WHEN** `npm run check` runs
- **THEN** the non-class assertions in `login-form.test.ts` and `dashboard-shell.test.ts` and all of `no-password.test.ts` pass unmodified

## ADDED Requirements

### Requirement: Shared design classes in ui.ts

`apps/web/src/components/ui.ts` SHALL export non-empty class-string constants `container`, `card`, `cardTitle`, `pageTitle`, `buttonPrimary`, `buttonSecondary`, `buttonDanger`, `input`, `pillGreen`, `pillAmber`, `pillRed`, `pillAccent`, `pillGrey`, `table`, `th`, `td`, `navLink`, `navLinkCurrent`, `alertError` and `alertWarning`, built only from design-token classes.

#### Scenario: Constants exist and follow the guide
- **GIVEN** the exports of `ui.ts`
- **WHEN** `ui.test.ts` inspects them
- **THEN** every listed name is a non-empty string; `card` contains `bg-card`, `rounded-card` and `shadow-card`; the three button constants contain `rounded-pill` and `min-h-10`; `buttonPrimary` contains `bg-accent`; `buttonDanger` contains `text-red`; `input` contains `rounded-` and a `focus` ring class; each `pill*` contains `rounded-pill`; `navLinkCurrent` contains `bg-accent-soft`

#### Scenario: No neutral or palette colours in ui.ts
- **GIVEN** the exports and the source text of `ui.ts`
- **WHEN** `ui.test.ts` inspects them
- **THEN** none contains `neutral-`, a Tailwind palette colour such as `red-50`, `amber-400` or `blue-600`, or a hex colour

### Requirement: Screens use the shared styles

Every page under `apps/web/src/app` and every component under `apps/web/src/components` that renders markup SHALL take colours from design tokens, SHALL NOT contain `neutral-*` classes, Tailwind palette colour classes or hex colours, and SHALL import its buttons, cards, tables, pills and alerts from `ui.ts`.

#### Scenario: No hard-coded colours
- **GIVEN** all `*.tsx` files under `apps/web/src/app` and `apps/web/src/components`
- **WHEN** `apps/web/src/components/design-adoption.test.ts` scans their source
- **THEN** none matches `neutral-\d`, `\b(red|green|amber|yellow|blue|rose|slate|gray|zinc|stone)-\d{2,3}\b` or `#[0-9a-fA-F]{3,8}\b`

#### Scenario: Pages and views use ui.ts
- **GIVEN** the login, dashboard, children, devices, block rules, homework, usage (focus), install, settings and privacy pages, and the components `children-list`, `device-list`, `block-rules-view`, `homework-settings-view`, `focus-overview-view`, `install-instructions` and `offline-banner`
- **WHEN** `design-adoption.test.ts` reads each source file
- **THEN** each imports from `ui` (`./ui` or `components/ui`) and uses at least one of its exports

#### Scenario: Offline banner uses the soft warning style
- **GIVEN** `apps/web/src/components/offline-banner.tsx`
- **WHEN** `design-adoption.test.ts` reads its source
- **THEN** its `role="alert"` element uses `alertWarning`, and its text and alert-loading call are unchanged

#### Scenario: Dark mode only through tokens
- **GIVEN** the sources of `ui.ts` and all components and pages
- **WHEN** `design-adoption.test.ts` scans them
- **THEN** none contains a `dark:` variant class

### Requirement: Icon is favicon, nav and login icon

The app SHALL serve `docs/design/icon.svg` as its favicon and as the icon in the nav bar and on the login card.

#### Scenario: Icon files match the design source
- **GIVEN** `docs/design/icon.svg`
- **WHEN** `styles-wiring.test.ts` compares it with `apps/web/src/app/icon.svg` and `apps/web/public/icon.svg`
- **THEN** both are identical to the source and `apps/web/src/app/favicon.ico` no longer exists

### Requirement: Readable colours in light and dark

The tokens used for text SHALL reach a 4.5:1 contrast ratio on the surfaces they are used on, in light and dark mode.

#### Scenario: Contrast of text pairs
- **GIVEN** `apps/web/src/styles/tokens.css` light values and its `prefers-color-scheme: dark` values
- **WHEN** `apps/web/src/styles/contrast.test.ts` computes WCAG contrast
- **THEN** `--ink` and `--ink-2` on `--card`, `--ground` and `--shell`, `--accent-contrast` on `--accent`, `--accent-ink` on `--accent-soft`, and `--ink` on each of `--green-soft`, `--amber-soft` and `--red-soft` are at least 4.5 in both modes
