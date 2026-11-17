# dashboard-shell Specification

## Purpose
A signed-in parent sees one consistent dashboard frame (family name, sign-out, navigation) that later issues fill with content.

Test files:
- `apps/web/src/lib/family.test.ts`
- `apps/web/src/components/dashboard-shell.test.ts`

## Requirements

### Requirement: Family name from the first-sign-in family
`getFamilyName(client)` SHALL read the signed-in parent's family name from `parents` joined to `families` (row access limited by RLS). The family and parent rows are created by the database trigger on first sign-in; the web app SHALL NOT insert them. If no row, an empty name or a query error is returned, it SHALL return `"My family"`.

#### Scenario: Family created on first sign-in is shown
- **GIVEN** a fake client whose `from("parents").select("families(name)").maybeSingle()` resolves `{ data: { families: { name: "Tran family" } }, error: null }`
- **WHEN** `getFamilyName(client)` is called (`family.test.ts`)
- **THEN** it returns `"Tran family"`
- **AND** `from` was called only with `"parents"` and no insert, update or upsert was called

#### Scenario: Missing family falls back
- **GIVEN** a fake client resolving `{ data: null, error: null }`, then one resolving `{ data: { families: { name: "" } }, error: null }`, then one resolving a non-null `error`
- **WHEN** `getFamilyName(client)` is called for each (`family.test.ts`)
- **THEN** each returns `"My family"`

### Requirement: Dashboard header
The dashboard shell SHALL show the family name and a "Sign out" button in a form that posts to `/auth/sign-out`.

#### Scenario: Header shows family name and sign-out
- **WHEN** a test renders `DashboardShell` with `familyName` `"Tran family"` and child text `"page body"` (`dashboard-shell.test.ts`)
- **THEN** the markup contains `"Tran family"` and `"page body"`
- **AND** it contains a form with `method="post"` and `action="/auth/sign-out"` holding a button with text "Sign out"

### Requirement: Dashboard navigation
The shell SHALL show a nav with exactly these links in order: Overview `/dashboard`, Children `/dashboard/children`, Devices `/dashboard/devices`, Install `/dashboard/install`. Each target SHALL exist as a page under `app/dashboard/`.

#### Scenario: Nav items are fixed
- **WHEN** a test reads the exported `DASHBOARD_NAV` (`dashboard-shell.test.ts`)
- **THEN** it equals `[{ label: "Overview", href: "/dashboard" }, { label: "Children", href: "/dashboard/children" }, { label: "Devices", href: "/dashboard/devices" }, { label: "Install", href: "/dashboard/install" }]`

#### Scenario: Nav renders as links
- **WHEN** a test renders `DashboardShell` (`dashboard-shell.test.ts`)
- **THEN** the markup contains a `<nav` with `<a` elements whose `href` values are `/dashboard`, `/dashboard/children`, `/dashboard/devices`, `/dashboard/install` in that order

#### Scenario: Nav targets exist
- **WHEN** a test checks the file system (`dashboard-shell.test.ts`)
- **THEN** `apps/web/src/app/dashboard/page.tsx`, `children/page.tsx`, `devices/page.tsx` and `install/page.tsx` under it exist
