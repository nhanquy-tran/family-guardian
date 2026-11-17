# Spec Delta

## Purpose
Delete usage and block history older than 13 months automatically.

Test files:
- `supabase/tests/data-retention.test.ts`: PGlite harness; migration and `purge_old_data`.

## ADDED Requirements

### Requirement: Old usage and block events are purged
`purge_old_data(p_now)` SHALL delete `usage_minutes` rows (by `minute_utc`) and `block_events` rows (by `at`) earlier than `p_now - 13 months`, keep all others, and return the deleted counts.

#### Scenario: Old rows deleted, recent kept
- **GIVEN** `p_now = 2026-11-17T12:00:00Z` and usage and block events at 2025-10-17T11:59:00Z, exactly 2025-10-17T12:00:00Z, and 2026-11-01
- **WHEN** `purge_old_data(p_now)` runs
- **THEN** only the 2025-10-17T11:59:00Z rows are gone and the returned counts are 1 and 1

#### Scenario: Nothing to purge
- **GIVEN** only recent rows
- **WHEN** `purge_old_data` runs twice
- **THEN** the counts are 0 and 0 both times and no row is removed

#### Scenario: Other tables untouched
- **GIVEN** children, devices, block rules and alerts older than 13 months
- **WHEN** `purge_old_data` runs
- **THEN** those rows still exist

### Requirement: Function is not callable by clients
`purge_old_data` SHALL be executable by `service_role` only.

#### Scenario: Roles
- **WHEN** `anon` and `authenticated` call it
- **THEN** both get a permission error and no row is deleted
- **AND** `service_role` can call it

### Requirement: Daily schedule
The migration SHALL schedule job `purge-old-data` daily when `pg_cron` exists and SHALL NOT fail when it does not.

#### Scenario: Migration applies without pg_cron
- **GIVEN** the PGlite harness (no `pg_cron`)
- **WHEN** all migrations are applied
- **THEN** no error occurs and `purge_old_data` exists

### Requirement: Failure leaves data intact
A failing purge SHALL roll back entirely and be retried by the next daily run.

#### Scenario: Error mid-purge
- **GIVEN** a temporary trigger that makes deleting from `block_events` raise
- **WHEN** `purge_old_data` runs
- **THEN** it raises and the old `usage_minutes` rows are still present
- **AND** after the trigger is dropped, a second run deletes both
