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

### Requirement: Usage categories use family overrides
`summarizeDay`, `summarizeWeek` and `buildTimeline` SHALL accept an optional overrides map passed to `categorize`. The usage page SHALL load `domain_categories` with the session client (global rows first, family rows win) and pass it. If loading fails, the page SHALL show the usage error, not seed-only categories. The focus score uses homework domains, not categories, so overrides do not affect it.

#### Scenario: Override changes the category breakdown
File: `packages/shared/src/usage-summary.test.ts`
- **WHEN** `summarizeDay([{ domain: "youtube.com", seconds: 600 }], { "youtube.com": "education" })` is called
- **THEN** `byCategory.education` is 600 and `byCategory.entertainment` is 0

#### Scenario: Overrides query failure shows the usage error
File: `apps/web/src/lib/usage.test.ts`
- **GIVEN** the fake client's `domain_categories` query returns an error
- **WHEN** `loadUsage` is called
- **THEN** the result is `{ status: "error" }` and no usage data is returned

#### Scenario: Top sites row wraps at 375 px
File: `apps/web/src/components/usage-change-category.test.ts`
- **WHEN** `UsageView` renders top sites
- **THEN** each top-site row has the `flex-wrap` class and the source has no `w-[`, `min-w-[` or `whitespace-nowrap`
