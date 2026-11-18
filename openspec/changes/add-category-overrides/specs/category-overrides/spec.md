# category-overrides Specification

## Purpose
Parents correct the category of a domain for their whole family; the override wins over the seed and global rows and reaches every child's device through `rules_version`.

Test files:
- `supabase/tests/category-overrides.test.ts` (PGlite, all migrations applied)
- `apps/web/src/lib/category-overrides.test.ts` (fake client)
- `apps/web/src/components/category-overrides-view.test.ts` (`renderToStaticMarkup`)

## ADDED Requirements

### Requirement: Family overrides are protected and bump the rules version
Family rows in `domain_categories` SHALL be readable and writable only by parents of that family; global rows (`family_id` null) SHALL be readable but never writable by parents. Insert, update and delete of a family row SHALL increase `rules_version` of every child of that family and of no other family.

#### Scenario: Parent reads global and own rows only
File: `supabase/tests/category-overrides.test.ts`
- **GIVEN** a global row, a row of family A and a row of family B
- **WHEN** parent A selects from `domain_categories`
- **THEN** the global row and A's row are returned and B's row is not

#### Scenario: Parent cannot write global or foreign rows
File: `supabase/tests/category-overrides.test.ts`
- **WHEN** parent A inserts a row with `family_id` null, updates and deletes the global row, inserts a row for family B, and updates and deletes B's row
- **THEN** the inserts fail with an RLS violation and the updates and deletes affect zero rows

#### Scenario: Family changes bump every child of the family only
File: `supabase/tests/category-overrides.test.ts`
- **GIVEN** family A with two children and family B with one child
- **WHEN** parent A inserts an override, changes its category and deletes it
- **THEN** each step increases `rules_version` of both of A's children by 1 and B's child is unchanged

### Requirement: Override data access
`listCategoryOverrides(client)`, `saveCategoryOverride(client, domainInput, category)` and `removeCategoryOverride(client, id)` SHALL use the given session client. Input SHALL be validated before any write: the domain with `normalizeBlockDomain`, the category against `CATEGORIES`. Store errors SHALL return an error code and never throw.

#### Scenario: Save normalises the domain and upserts
File: `apps/web/src/lib/category-overrides.test.ts`
- **GIVEN** a fake client that returns family id `fam-1` for `parents`
- **WHEN** `saveCategoryOverride(client, " https://www.YouTube.com/watch?v=x ", "education")` is called
- **THEN** the fake receives one upsert into `domain_categories` with `{ family_id: "fam-1", domain: "youtube.com", category: "education" }` and conflict target `family_id,domain`
- **AND** the result is `{ ok: true }`

#### Scenario: Invalid input is not written
File: `apps/web/src/lib/category-overrides.test.ts`
- **WHEN** `saveCategoryOverride` is called with domain `"localhost"` and category `"games"`, then with domain `"youtube.com"` and category `"music"`
- **THEN** the results are `{ ok: false, error: "invalid_domain" }` and `{ ok: false, error: "invalid_category" }`
- **AND** the fake client receives no write

#### Scenario: Missing family fails closed
File: `apps/web/src/lib/category-overrides.test.ts`
- **GIVEN** the fake `parents` query returns no row, then an error
- **WHEN** `saveCategoryOverride(client, "youtube.com", "education")` is called
- **THEN** each result is `{ ok: false, error: "failed" }` and no upsert is made

#### Scenario: Save store failure
File: `apps/web/src/lib/category-overrides.test.ts`
- **GIVEN** the fake upsert returns an error
- **WHEN** `saveCategoryOverride(client, "youtube.com", "education")` is called
- **THEN** the result is `{ ok: false, error: "failed" }` and nothing throws

#### Scenario: List returns the family's rows sorted
File: `apps/web/src/lib/category-overrides.test.ts`
- **GIVEN** the fake returns rows `zeta.com games`, `alpha.com education` for the family
- **WHEN** `listCategoryOverrides(client)` is called
- **THEN** the query excludes global rows (`family_id` not null) and the result is `{ ok: true, overrides }` in the order `alpha.com`, `zeta.com`, each with `id`, `domain` and `category`

#### Scenario: List failure is not an empty list
File: `apps/web/src/lib/category-overrides.test.ts`
- **GIVEN** the fake select returns an error
- **WHEN** `listCategoryOverrides(client)` is called
- **THEN** the result is `{ ok: false, error: "failed" }`

#### Scenario: Remove an override
File: `apps/web/src/lib/category-overrides.test.ts`
- **GIVEN** the fake delete returns one row
- **WHEN** `removeCategoryOverride(client, id)` is called
- **THEN** it deletes from `domain_categories` filtered by `id` and returns `{ ok: true }`
- **AND GIVEN** the delete returns zero rows, the result is `{ ok: false, error: "not_found" }`, and with an error it is `{ ok: false, error: "failed" }`

### Requirement: Categories page
The page `/dashboard/categories` SHALL render `CategoryOverridesView`: each override with its domain, category and a remove form carrying its id, a form with a domain input and a `<select>` of exactly the 9 categories, an empty-state message, a readable message per error code, and a domain input pre-filled from the `domain` prop. Each remove button SHALL name the domain it removes. Styles SHALL come from `ui.ts`, without fixed widths.

#### Scenario: Overrides listed with remove forms
File: `apps/web/src/components/category-overrides-view.test.ts`
- **WHEN** the view renders with overrides `youtube.com education` and `roblox.com games`
- **THEN** the markup contains both domains and categories and two remove forms, each carrying its override id
- **AND** each remove button's accessible label contains its domain

#### Scenario: Form offers the fixed categories
File: `apps/web/src/components/category-overrides-view.test.ts`
- **WHEN** the view renders
- **THEN** the markup has a text input named `domain` and a `<select>` whose option values are exactly the 9 categories

#### Scenario: Domain pre-filled
File: `apps/web/src/components/category-overrides-view.test.ts`
- **WHEN** the view renders with `domain` `"roblox.com"`
- **THEN** the domain input has `value="roblox.com"`
- **AND** without `domain` the input has no value

#### Scenario: Empty state and error messages
File: `apps/web/src/components/category-overrides-view.test.ts`
- **WHEN** the view renders with no overrides and no error, then with error `invalid_domain`, `invalid_category`, `not_found` and `failed`
- **THEN** the first markup contains `No overrides`
- **AND** each error markup contains a distinct readable message

#### Scenario: Listing failure is not shown as empty
File: `apps/web/src/components/category-overrides-view.test.ts`
- **WHEN** the view renders with error `failed` and no overrides
- **THEN** the markup contains a message that overrides could not be loaded or saved and does not contain `No overrides`

#### Scenario: Design tokens and width
File: `apps/web/src/components/category-overrides-view.test.ts`
- **WHEN** the view's source file is read
- **THEN** it imports from `./ui`, and contains no `w-[`, `min-w-[` or `whitespace-nowrap`
