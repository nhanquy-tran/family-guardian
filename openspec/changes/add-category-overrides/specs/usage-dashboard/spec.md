## ADDED Requirements

### Requirement: Change category from top sites
Every site in the usage page's "Top sites" lists (Today and Week) SHALL have a "Change category" link to `/dashboard/categories?domain=<encoded domain>`, a plain anchor that works without JavaScript.

#### Scenario: Top sites link to the categories form
File: `apps/web/src/components/usage-change-category.test.ts`
- **GIVEN** a usage result whose top sites are `youtube.com` and `docs.google.com`
- **WHEN** `UsageView` renders the Today view and the Week view
- **THEN** each markup contains `<a` elements with text `Change category` and `href` `/dashboard/categories?domain=youtube.com` and `/dashboard/categories?domain=docs.google.com`

#### Scenario: No sites, no links
File: `apps/web/src/components/usage-change-category.test.ts`
- **WHEN** `UsageView` renders a day with no top sites
- **THEN** the markup contains `No activity yet.` and no `Change category`
