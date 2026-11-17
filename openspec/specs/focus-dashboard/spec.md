# focus-dashboard Specification

## Purpose
Parents choose what counts as homework per child and see the daily focus score with a 7-day trend.

Test files (Vitest, run by `npm run check`):
- `supabase/tests/homework-settings.test.ts`: database scenarios on PGlite (harness from `add-database-schema`), after applying every migration.
- `packages/shared/src/homework.test.ts`: domain resolution.
- `apps/web/src/lib/homework.test.ts`, `apps/web/src/lib/focus-overview.test.ts`: modules with fake Supabase clients.
- `apps/web/src/components/focus-overview-view.test.ts`, `apps/web/src/components/homework-settings-view.test.ts`: `renderToStaticMarkup` with `createElement`.

Unless a scenario says otherwise, the homework settings are categories `["education"]` and no extra domains, and the timezone is `UTC`.

## Requirements

### Requirement: Homework domains are validated and parent-editable
The database SHALL store `children.homework_domains` as at most 50 bare lowercase hostnames, let a parent update it and `homework_categories` only for their own family's children, and default new children to the `education` category.

#### Scenario: Invalid domain lists rejected
File: `supabase/tests/homework-settings.test.ts`
- **WHEN** the service role sets `homework_domains` to `{"https://a.com/x"}`, to `{"A.com"}`, and to 51 valid hostnames
- **THEN** each write fails with a check violation
- **AND** `{"school.example.org"}` succeeds

#### Scenario: Parent edits own child only
File: `supabase/tests/homework-settings.test.ts`
- **GIVEN** parents of two families, each with a child
- **WHEN** parent A updates `homework_domains` and `homework_categories` of child A, and of child B
- **THEN** child A changes and the update of child B affects 0 rows

#### Scenario: New child defaults to education
File: `supabase/tests/homework-settings.test.ts`
- **WHEN** a parent inserts a child with only a name
- **THEN** `homework_categories` is `{education}` and `homework_domains` is empty

#### Scenario: Homework settings do not bump rules version
File: `supabase/tests/homework-settings.test.ts`
- **WHEN** a parent changes `homework_categories` and `homework_domains`
- **THEN** `rules_version` is unchanged

### Requirement: Resolving homework domains
`homeworkDomainsFor(usageDomains, { categories, extraDomains })` SHALL return the sorted, distinct usage domains whose category is selected, or that equal or are a subdomain of an extra domain.

#### Scenario: Category match
File: `packages/shared/src/homework.test.ts`
- **WHEN** called with `["khanacademy.org", "youtube.com"]`, categories `["education"]`, no extra domains
- **THEN** it returns `["khanacademy.org"]`

#### Scenario: Extra domain and its subdomains
File: `packages/shared/src/homework.test.ts`
- **WHEN** called with `["example-school.org", "portal.example-school.org", "notexample-school.org"]`, no categories, extra domains `["example-school.org"]`
- **THEN** it returns `["example-school.org", "portal.example-school.org"]`

#### Scenario: Nothing selected
File: `packages/shared/src/homework.test.ts`
- **WHEN** called with `["khanacademy.org"]`, no categories and no extra domains
- **THEN** it returns `[]`

#### Scenario: Duplicates removed and order stable
File: `packages/shared/src/homework.test.ts`
- **WHEN** called with `["khanacademy.org", "coursera.org", "khanacademy.org"]` and categories `["education"]`
- **THEN** it returns `["coursera.org", "khanacademy.org"]`

### Requirement: Managing homework settings
The settings module SHALL validate input, normalize domains with `normalizeBlockDomain`, and report failures as results, never throw.

#### Scenario: Save categories
File: `apps/web/src/lib/homework.test.ts`
- **WHEN** `saveHomeworkCategories(client, childId, ["education", "productivity"])` is called
- **THEN** the child's `homework_categories` is updated to exactly those values and the result is `{ ok: true }`

#### Scenario: Unknown category rejected
File: `apps/web/src/lib/homework.test.ts`
- **WHEN** `saveHomeworkCategories` is called with `["education", "music"]`
- **THEN** the result is `invalid_category` and no write happens

#### Scenario: Add domain normalizes
File: `apps/web/src/lib/homework.test.ts`
- **WHEN** `addHomeworkDomain(client, childId, " https://www.Khanacademy.org/x ")` is called
- **THEN** `khanacademy.org` is appended to `homework_domains` and the result is `{ ok: true }`

#### Scenario: Invalid, duplicate and too many domains
File: `apps/web/src/lib/homework.test.ts`
- **WHEN** a domain `not a domain` is added, then `khanacademy.org` when it already exists, then any domain when 50 exist
- **THEN** the results are `invalid_domain`, `duplicate` and `too_many`, and nothing is written

#### Scenario: Remove domain
File: `apps/web/src/lib/homework.test.ts`
- **GIVEN** `homework_domains` is `["a.org", "b.org"]`
- **WHEN** `removeHomeworkDomain(client, childId, "a.org")` is called
- **THEN** the stored list is `["b.org"]`

#### Scenario: Store failure and unknown child
File: `apps/web/src/lib/homework.test.ts`
- **WHEN** the read or the update returns an error
- **THEN** the result is `failed` and nothing is thrown
- **AND** when the update affects 0 rows (child of another family) the result is `not_found`

### Requirement: Focus overview data
`loadFocusOverview` SHALL compute for every child of the family today's focus score parts and the scores of the last 7 local days (oldest first, today last), using the child's homework settings and the parent's timezone.

#### Scenario: Today and trend
File: `apps/web/src/lib/focus-overview.test.ts`
- **GIVEN** today 10 homework minutes followed by 10 other minutes (one switch is counted by the formula, so the expected score comes from `computeFocusScore`), yesterday only homework minutes, other days empty
- **WHEN** the overview is loaded
- **THEN** today has homework 600 s, other 600 s, 1 switch and the score `computeFocusScore` returns for the same entries; the trend has 7 entries, yesterday scores 100, empty days have `null`

#### Scenario: Settings drive homework
File: `apps/web/src/lib/focus-overview.test.ts`
- **GIVEN** usage on `youtube.com` and `khanacademy.org`, child extra domain `youtube.com`, categories `["education"]`
- **WHEN** the overview is loaded
- **THEN** both domains count as homework

#### Scenario: Day boundary uses the timezone
File: `apps/web/src/lib/focus-overview.test.ts`
- **GIVEN** timezone `Asia/Ho_Chi_Minh` and a minute at `23:30 UTC` the day before today (06:30 local today)
- **WHEN** the overview is loaded
- **THEN** that minute counts for today, not yesterday

#### Scenario: More than 1000 rows
File: `apps/web/src/lib/focus-overview.test.ts`
- **GIVEN** a fake client that returns 1000 rows per page and 1500 rows in total
- **WHEN** the overview is loaded
- **THEN** all 1500 rows are counted

#### Scenario: Page cap fails visibly
File: `apps/web/src/lib/focus-overview.test.ts`
- **GIVEN** a fake client that always returns full pages
- **WHEN** the overview is loaded
- **THEN** that child's result is an error after 30 pages, with no numbers

#### Scenario: Child without devices
File: `apps/web/src/lib/focus-overview.test.ts`
- **WHEN** a child has no devices
- **THEN** today's score is `null` with zero times, and no usage query is made

#### Scenario: Failure is per child and never partial
File: `apps/web/src/lib/focus-overview.test.ts`
- **GIVEN** two children and the usage read fails on the second page for the first child
- **WHEN** the overview is loaded
- **THEN** the first child is an error result without numbers and the second child has its data

#### Scenario: Children list failure
File: `apps/web/src/lib/focus-overview.test.ts`
- **WHEN** listing children fails
- **THEN** the loader returns an overall error, distinct from an empty family

### Requirement: Focus overview display
The `/dashboard` overview SHALL show per child today's score, homework time, other time, switches, a 7-day trend and a short explanation, readable at 375 px.

#### Scenario: Score, times and trend
File: `apps/web/src/components/focus-overview-view.test.ts`
- **WHEN** rendered with a child scoring 72 (homework 1 h 05 min, other 25 min, 4 switches) and a 7-day trend
- **THEN** the markup contains the child's name, `72`, `1 h 05 min`, `25 min`, `4`, and 7 trend items each with its score as text

#### Scenario: Days without data
File: `apps/web/src/components/focus-overview-view.test.ts`
- **WHEN** rendered with today's score `null` and trend days `null`
- **THEN** it shows "No activity" for today and "no data" for those days, and no `0` score

#### Scenario: Homework not configured
File: `apps/web/src/components/focus-overview-view.test.ts`
- **WHEN** a child has no homework categories and no extra domains
- **THEN** the card shows a prompt linking to `/dashboard/children/<id>/homework` instead of a score

#### Scenario: Explanation
File: `apps/web/src/components/focus-overview-view.test.ts`
- **WHEN** rendered
- **THEN** the markup explains the score: share of time on homework sites, up to 20 points off for switching, and no score without activity

#### Scenario: Error state
File: `apps/web/src/components/focus-overview-view.test.ts`
- **WHEN** a child result is an error
- **THEN** that card shows "Could not load" and no score or time values, and other cards still render

#### Scenario: No children
File: `apps/web/src/components/focus-overview-view.test.ts`
- **WHEN** rendered with no children
- **THEN** it shows a link to `/dashboard/children` to add one

### Requirement: Homework settings page
The page SHALL let a parent choose homework categories and add or remove extra domains for one child.

#### Scenario: Current settings shown
File: `apps/web/src/components/homework-settings-view.test.ts`
- **WHEN** rendered with categories `["education"]` and extra domains `["a.org"]`
- **THEN** the 9 categories are listed as checkboxes with only `education` checked, `a.org` is listed with a remove button, and the forms carry the child id

#### Scenario: Error message
File: `apps/web/src/components/homework-settings-view.test.ts`
- **WHEN** rendered with error `duplicate`
- **THEN** a readable message such as "That site is already in the list" is shown
