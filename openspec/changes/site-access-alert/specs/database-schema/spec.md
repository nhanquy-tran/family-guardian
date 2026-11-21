## ADDED Requirements

### Requirement: Devices store the latest site-access value
`devices` SHALL have `site_access boolean not null default true`, readable by parents of the device's family (column grant) and writable only by the service role. Existing rows SHALL become `true`. The migration SHALL NOT update, delete or re-grant anything else.

#### Scenario: Default, read and write rights
File: `supabase/tests/site-access.test.ts`
- **GIVEN** the migrations are applied and a device of parent A's child exists
- **WHEN** its row is read, then parent A selects `site_access`, then parent A and `anon` run `update devices set site_access = false`, then the service role runs it
- **THEN** it was `true`, parent A sees `true`, both API roles are denied, and the service role succeeds
- **AND** parent A still cannot select `token_hash`

### Requirement: Incidents of lost site access are recorded by a trigger
`site_access_incidents (id, device_id, started_at, resolved_at)` SHALL be filled only by a trigger on `devices`: true to false inserts an open incident at the database's now, false to true resolves the open one, and repeating a value changes nothing. A device SHALL have at most one open incident, and deleting a device SHALL delete its incidents. The trigger function SHALL be `security definer` with an empty `search_path`, not executable by `public`, `anon` or `authenticated`.

#### Scenario: Open and resolve
File: `supabase/tests/site-access.test.ts`
- **GIVEN** a device with `site_access` true
- **WHEN** the service role sets it to `false`, then `false` again, then `true`, then `true` again
- **THEN** exactly one incident exists, with `started_at` set and `resolved_at` set after the third statement and unchanged after the fourth

#### Scenario: Second incident after recovery
File: `supabase/tests/site-access.test.ts`
- **GIVEN** a device with one resolved incident
- **WHEN** the service role sets `site_access` to `false` again
- **THEN** two incidents exist and only the newer one is open
- **AND** a second open incident cannot be inserted for the device by the service role

#### Scenario: Device deleted
File: `supabase/tests/site-access.test.ts`
- **GIVEN** a device with an open incident
- **WHEN** the service role deletes the device
- **THEN** no incident row for it remains

### Requirement: Only the parent's family reads incidents
`site_access_incidents` SHALL have row level security enabled, a `select` policy for authenticated parents limited to devices of children of their family, and no insert, update or delete right for `anon` or `authenticated`.

#### Scenario: Family isolation and no writes
File: `supabase/tests/site-access.test.ts`
- **GIVEN** open incidents for devices of families A and B
- **WHEN** parent A selects all incidents, then parent A and `anon` try to insert, update and delete one
- **THEN** parent A sees only family A's incident and every write is denied

### Requirement: Old incidents are purged after 90 days
`purge_site_access_incidents()` SHALL delete incidents whose `coalesce(resolved_at, started_at)` is more than 90 days before now and keep all others, including open ones younger than 90 days. It SHALL be executable by `service_role` only. A migration SHALL schedule it daily when `pg_cron` exists and SHALL NOT fail when it does not.

#### Scenario: Purge boundary and permissions
File: `supabase/tests/site-access.test.ts`
- **GIVEN** incidents resolved 91 and 89 days ago, an open one started 91 days ago, and an open one started 1 day ago
- **WHEN** the service role runs `purge_site_access_incidents()`, and `anon` and an authenticated parent try it
- **THEN** only the 89-day and the 1-day incidents remain and both API roles are denied

#### Scenario: Migration loads without pg_cron
File: `supabase/tests/site-access.test.ts`
- **GIVEN** the PGlite harness has no `pg_cron`
- **WHEN** the migrations run
- **THEN** they succeed and `purge_site_access_incidents` exists
