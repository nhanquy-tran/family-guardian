## MODIFIED Requirements

### Requirement: Screens use the shared styles

Every page under `apps/web/src/app` and every component under `apps/web/src/components` that renders markup SHALL take colours from design tokens, SHALL NOT contain `neutral-*` classes, Tailwind palette colour classes or hex colours, and SHALL import its buttons, cards, tables, pills and alerts from `ui.ts`.

#### Scenario: No hard-coded colours
- **GIVEN** all `*.tsx` files under `apps/web/src/app` and `apps/web/src/components`
- **WHEN** `apps/web/src/components/design-adoption.test.ts` scans their source
- **THEN** none matches `neutral-\d`, `\b(red|green|amber|yellow|blue|rose|slate|gray|zinc|stone)-\d{2,3}\b` or `#[0-9a-fA-F]{3,8}\b`

#### Scenario: Pages and views use ui.ts
- **GIVEN** the login, dashboard, devices, usage (focus), install, settings and privacy pages, and the components `children-list`, `device-list`, `block-rules-view`, `daily-limits-card`, `homework-settings-view`, `focus-overview-view`, `install-instructions` and `offline-banner` (the children and homework pages render only one of these views, and the block rules page renders only `block-rules-view` and `daily-limits-card`; none has markup of its own, so they are covered through their components)
- **WHEN** `design-adoption.test.ts` reads each source file
- **THEN** each imports from `ui` (`./ui`, `@/components/ui`, or `components/ui` through a relative path at any depth such as `../../components/ui`) and uses at least one of its exports

#### Scenario: Offline banner uses the soft warning style
- **GIVEN** `apps/web/src/components/offline-banner.tsx`
- **WHEN** `design-adoption.test.ts` reads its source
- **THEN** its `role="alert"` element uses `alertWarning`, and its text and alert-loading call are unchanged

#### Scenario: Dark mode only through tokens
- **GIVEN** the sources of `ui.ts` and all components and pages
- **WHEN** `design-adoption.test.ts` scans them
- **THEN** none contains a `dark:` variant class
