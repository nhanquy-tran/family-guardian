# database-schema Specification

## Purpose
The Supabase schema for the MVP: tables, keys, privacy constraints, row level security per family, and family creation on first sign-in.

All scenarios are Vitest tests in `supabase/tests/schema.test.ts`, run against PGlite with the Supabase stand-in from `supabase/tests/harness.ts` (roles `anon`, `authenticated`, `service_role`; `auth.users`; `auth.uid()`), after applying every file in `supabase/migrations/` in name order. "Parent A" and "parent B" are two `auth.users` rows inserted by the test, which by the trigger belong to two different families. The README scenario is in the same file.

## Requirements

### Requirement: Migration creates the MVP tables
The migrations in `supabase/migrations/` SHALL apply cleanly in name order and create the tables `families`, `parents`, `children`, `devices`, `pairing_codes`, `usage_minutes`, `block_rules`, `domain_categories`, `block_events` and `alerts` in schema `public`.

#### Scenario: All tables exist
- **GIVEN** an empty database with the Supabase stand-in
- **WHEN** the migrations are applied
- **THEN** no error is raised
- **AND** `information_schema.tables` lists all 10 tables in `public`

#### Scenario: Migration file naming
- **WHEN** a test lists `supabase/migrations/`
- **THEN** every file name matches `^\d{14}_[a-z0-9_]+\.sql$`

### Requirement: Idempotent usage upserts
`usage_minutes` SHALL have the primary key `(device_id, minute_utc, domain)`, so a repeated heartbeat for the same device, minute and domain updates one row instead of adding a second.

#### Scenario: Primary key columns
- **WHEN** a test reads the primary key of `usage_minutes` from the catalog
- **THEN** its columns are exactly `device_id`, `minute_utc`, `domain` in that order

#### Scenario: Upsert does not duplicate
- **GIVEN** a device and a row `(device, 2026-11-17T10:00:00Z, youtube.com, 30)` inserted by the service role
- **WHEN** the service role runs `insert ... on conflict (device_id, minute_utc, domain) do update set seconds = excluded.seconds` with seconds `45`
- **THEN** there is exactly one row for that key and its seconds is `45`

### Requirement: Privacy constraints on stored data
The database SHALL reject values that are not a bare registrable-style domain in every `domain` column (`usage_minutes`, `block_events`, `domain_categories`), and SHALL reject usage seconds outside 1..60 and usage minutes that are not whole minutes (ADR 0005).

#### Scenario: URL or path rejected as domain
- **WHEN** the service role inserts a `usage_minutes` row with domain `https://youtube.com/watch?v=x`, then one with `youtube.com/watch`, then one with `YouTube.com`, then one with `""`
- **THEN** each insert fails with a check violation

#### Scenario: Block event domain checked too
- **WHEN** the service role inserts a `block_events` row with domain `tiktok.com/@user`
- **THEN** the insert fails with a check violation
- **AND** inserting domain `tiktok.com` succeeds

#### Scenario: Seconds bounds
- **WHEN** the service role inserts `usage_minutes` rows with seconds `0` and `61`
- **THEN** each insert fails
- **AND** seconds `1` and `60` succeed

#### Scenario: Whole minutes only
- **WHEN** the service role inserts a `usage_minutes` row with `minute_utc` `2026-11-17T10:00:30Z`
- **THEN** the insert fails with a check violation

### Requirement: Value constraints
`devices.browser` SHALL be one of `chrome`, `edge`, `brave`, `firefox`, `other`. `block_rules.kind` SHALL be `domain` or `category`. `pairing_codes.code` SHALL be 6 characters `A-Z0-9`. `children.homework_categories` and `domain_categories.category` SHALL only contain `education`, `entertainment`, `social`, `games`, `news`, `shopping`, `communication`, `productivity`, `other`. `alerts.kind` SHALL be `offline`. The migration that added `firefox` SHALL NOT update, delete or re-grant anything.

#### Scenario: Invalid enum values rejected
- **WHEN** the service role inserts a device with browser `netscape`, a block rule with kind `url`, a pairing code `abc123`, a child with homework category `homework`, a domain category `music`, and an alert with kind `other` (`schema.test.ts`)
- **THEN** each insert fails with a check violation

#### Scenario: Valid values accepted
- **WHEN** the service role inserts a device with browser `edge`, a device with browser `firefox`, a block rule with kind `category` and value `games`, a pairing code `AB12CD`, a child with homework categories `{education,productivity}` and an alert with kind `offline` (`schema.test.ts`)
- **THEN** each insert succeeds

#### Scenario: Firefox migration only changes the check
- **WHEN** `schema.test.ts` reads the `firefox` migration file in `supabase/migrations`
- **THEN** it contains no `update`, `delete`, `truncate`, `grant` or `revoke` statement
- **AND** it drops and re-adds the check named `devices_browser_check` on `devices`, with `firefox` among the allowed values

### Requirement: Family created on first sign-in
When a row is inserted into `auth.users`, the database SHALL create a new family and a `parents` row linking that user to it. The family name SHALL be the user's `full_name` metadata, or `My family` when missing.

#### Scenario: New user gets a family
- **WHEN** a user is inserted into `auth.users` with `raw_user_meta_data` `{"full_name": "Lan Nguyen"}`
- **THEN** exactly one `parents` row exists for that user
- **AND** its family exists with name `Lan Nguyen`

#### Scenario: Missing name
- **WHEN** a user is inserted with empty `raw_user_meta_data`
- **THEN** the user's family is named `My family`

#### Scenario: Two users get two families
- **WHEN** two users are inserted
- **THEN** their `parents` rows reference two different families

#### Scenario: Deleting the user removes the parent row
- **WHEN** a user is deleted from `auth.users`
- **THEN** no `parents` row for that user remains

### Requirement: RLS enabled on every table
Row level security SHALL be enabled on all 10 tables.

#### Scenario: Catalog check
- **WHEN** a test reads `pg_class.relrowsecurity` for each of the 10 tables
- **THEN** every value is `true`

#### Scenario: Anonymous sees nothing
- **GIVEN** rows in every table created by the service role
- **WHEN** role `anon` selects from each table
- **THEN** each select returns zero rows or fails with a permission error
- **AND** every insert attempted by `anon` fails

### Requirement: Parents only see their own family
As role `authenticated` with `auth.uid()` set, a parent SHALL read only rows that belong to their own family: their family, its parents, its children, those children's devices, pairing codes, block rules, usage minutes, block events and alerts, plus global and own-family `domain_categories`.

#### Scenario: Parent A reads only family A
- **GIVEN** families A and B, each with one child, one device, one pairing code, one block rule, one usage row, one block event, one alert and one domain category override, created by the service role, plus one global domain category
- **WHEN** parent A selects from each table
- **THEN** every returned row belongs to family A (for `domain_categories`: family A's override and the global row)
- **AND** no row of family B is returned

#### Scenario: Device token hash is hidden from parents
- **WHEN** parent A runs `select token_hash from devices`
- **THEN** it fails with a permission error
- **AND** `select id, child_id, browser, os, last_seen_at, created_at from devices` succeeds and returns family A's device

### Requirement: Parents only write their own family
A parent SHALL be able to create, update and delete children, block rules, pairing codes and domain category overrides in their own family, update their family's name, and delete their family's devices. Any write that targets another family, or would move a row into another family, SHALL affect no rows or fail.

#### Scenario: Write own family
- **WHEN** parent A inserts a child into family A, a block rule and a pairing code for that child, a domain category override with family A, renames family A, and deletes family A's device
- **THEN** each statement succeeds and the change is visible to the service role

#### Scenario: Cannot write into another family
- **WHEN** parent A inserts a child with family B's id, inserts a block rule for family B's child, inserts a domain category with family B's id, and inserts a global domain category (`family_id` null)
- **THEN** each insert fails with an RLS violation

#### Scenario: Cannot change or delete another family's rows
- **WHEN** parent A updates family B's name, updates family B's child, deletes family B's block rule and deletes family B's device
- **THEN** each statement affects zero rows and the service role sees family B unchanged

#### Scenario: Cannot move a row to another family
- **WHEN** parent A updates their own child setting `family_id` to family B's id
- **THEN** the update fails with an RLS violation

### Requirement: Parents create pairing codes directly
A parent SHALL be able to insert a `pairing_codes` row for a child of their own family with the parent session (no server route needed), and SHALL NOT be able to insert one for another family's child.

#### Scenario: Parent creates a pairing code for their own child
- **GIVEN** parent A with a child in family A
- **WHEN** parent A inserts a `pairing_codes` row with code `AB12CD`, that child and `expires_at` one hour ahead
- **THEN** the insert succeeds
- **AND** parent A can select that row

#### Scenario: Cannot create a pairing code for another family's child
- **WHEN** parent A inserts a `pairing_codes` row for family B's child
- **THEN** the insert fails with an RLS violation

### Requirement: Active pairing codes are unique across all families
A `pairing_codes.code` value SHALL be in use by at most one row at a time across all families. A code whose `expires_at` is in the past SHALL NOT count as in use: inserting the same value SHALL succeed and replace the expired row. Rejecting a duplicate SHALL NOT reveal anything about the other family's code beyond the fact that the value is taken.

#### Scenario: Duplicate of another family's active code is rejected
- **GIVEN** family A has an active code `AB12CD` (`expires_at` in the future)
- **WHEN** parent B inserts `AB12CD` for their own child
- **THEN** the insert fails with a unique violation (SQLSTATE `23505`)
- **AND** family A's code row is unchanged (same child, same `expires_at`)
- **AND** parent B selecting from `pairing_codes` still sees no row of family A

#### Scenario: Duplicate within the same family is rejected
- **GIVEN** family A has an active code `AB12CD`
- **WHEN** parent A inserts `AB12CD` again for another child of family A
- **THEN** the insert fails with a unique violation (SQLSTATE `23505`)

#### Scenario: Expired code does not block the value
- **GIVEN** family A has a code `AB12CD` with `expires_at` in the past
- **WHEN** parent B inserts `AB12CD` for their own child with `expires_at` one hour ahead
- **THEN** the insert succeeds
- **AND** the service role sees exactly one `AB12CD` row, belonging to parent B's child

#### Scenario: Other codes are untouched by the cleanup
- **GIVEN** family A has an expired code `ZZ99ZZ` and an active code `AB12CD`
- **WHEN** parent B inserts `QQ11QQ`
- **THEN** the insert succeeds
- **AND** the service role still sees `ZZ99ZZ` and `AB12CD`

### Requirement: Device data written only by the service role
Parents SHALL NOT insert or update `devices`, `usage_minutes`, `block_events` or `alerts`, and SHALL NOT insert `families` or `parents`; these writes happen only through server routes with the service role (or the sign-in trigger).

#### Scenario: Parent cannot write device data
- **WHEN** parent A inserts a device for their own child, a `usage_minutes` row and a `block_events` row for their own device, an alert for their own device, updates their device's `last_seen_at`, inserts a `families` row and inserts a `parents` row
- **THEN** each statement fails or affects zero rows

#### Scenario: Service role writes device data
- **WHEN** the service role inserts a device, a usage row, a block event and an alert, and updates `devices.last_seen_at`
- **THEN** each statement succeeds

### Requirement: Migration documentation
`supabase/README.md` SHALL explain how to apply the migrations to the hosted project, the file naming rule, that applied migrations are never edited, and how to run the schema tests.

#### Scenario: README covers the essentials
- **WHEN** a test reads `supabase/README.md`
- **THEN** it contains `supabase db push`, `supabase/migrations` and `npm run check`
- **AND** it matches the case-insensitive pattern `never edit`
