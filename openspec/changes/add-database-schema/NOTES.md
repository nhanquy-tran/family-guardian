# Notes: add-database-schema (#7)

## What changed
- `supabase/migrations/20261117000000_initial_schema.sql`: 10 tables with keys, check constraints (domain regex, seconds 1..60, whole minutes, enums, categories) and indexes; RLS on all tables with family-scoped policies; `current_family_id()`; column-level select on `devices` (no `token_hash`); expired pairing code purge trigger; `handle_new_user()` trigger on `auth.users`.
- `supabase/README.md`: how to apply migrations, naming, never edit applied migrations, how to run tests.
- `@electric-sql/pglite` added as a root dev dependency.
- Tests (unchanged, from the test writer): `supabase/tests/schema.test.ts`, `harness.ts`.

## Verification
All 31 scenarios in `supabase/tests/schema.test.ts` pass against PGlite. `npm run check` and `npm run build` pass.

## For the human to check
- Apply the migration to the hosted project (`supabase db push`) and review the Supabase security advisor; PGlite uses a stand-in for Supabase roles and `auth`.
- The trigger functions are `security definer` with `search_path = ''`, and execute is revoked from `anon`/`authenticated`.
- Parents have no insert/update policy on `devices`, `usage_minutes`, `block_events`, `alerts`, `families` and `parents`; writes there are service-role only.
