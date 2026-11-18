## MODIFIED Requirements

### Requirement: Dashboard navigation
The shell SHALL show a nav with exactly these links in order: Overview `/dashboard`, Children `/dashboard/children`, Categories `/dashboard/categories`, Devices `/dashboard/devices`, Install `/dashboard/install`. Each target SHALL exist as a page under `app/dashboard/`.

#### Scenario: Nav items are fixed
- **WHEN** a test reads the exported `DASHBOARD_NAV` (`dashboard-shell.test.ts`)
- **THEN** it equals `[{ label: "Overview", href: "/dashboard" }, { label: "Children", href: "/dashboard/children" }, { label: "Categories", href: "/dashboard/categories" }, { label: "Devices", href: "/dashboard/devices" }, { label: "Install", href: "/dashboard/install" }]`

#### Scenario: Nav renders as links
- **WHEN** a test renders `DashboardShell` (`dashboard-shell.test.ts`)
- **THEN** the markup contains a `<nav` with `<a` elements whose `href` values are `/dashboard`, `/dashboard/children`, `/dashboard/categories`, `/dashboard/devices`, `/dashboard/install` in that order

#### Scenario: Nav targets exist
- **WHEN** a test checks the file system (`dashboard-shell.test.ts`)
- **THEN** `apps/web/src/app/dashboard/page.tsx`, `children/page.tsx`, `categories/page.tsx`, `devices/page.tsx` and `install/page.tsx` under it exist
