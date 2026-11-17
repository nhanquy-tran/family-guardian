# supabase

SQL migrations applied to production by CI on merge (`supabase-migrate.yml`, ADR 0011). Tests run every migration in PGlite (`supabase/tests/harness.ts`).

- Never edit an applied migration; add a new one with the `add-migration` skill. CI fails if a new migration is not newer than every migration on main or reuses a version.
- Every table: RLS enabled, policies limited to the parent's family. Parent-visible or parent-editable columns on `children` and `devices` need explicit column grants.
- `security definer` functions: `set search_path = ''` and `revoke execute ... from public, anon, authenticated`; grant to `service_role` only where the server calls them.
- `pg_cron`, `pg_net` and Vault are not in PGlite: guard them (`do $$ begin if exists (select 1 from pg_available_extensions where name = 'pg_cron') ...`) and verify on production after merge.
- Migrations must be additive. Dropping or renaming anything needs an ADR and the owner.
