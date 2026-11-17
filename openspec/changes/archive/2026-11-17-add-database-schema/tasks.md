# Tasks

## 1. Tests first

- [ ] 1.1 Add `@electric-sql/pglite` as a root dev dependency (`npm install -D @electric-sql/pglite`) and add `supabase/tests/**/*.test.ts` to `include` in `vitest.config.ts`
- [ ] 1.2 Write `supabase/tests/harness.ts` per design.md decision 6: create a PGlite instance, the Supabase stand-in (roles, default grants, `auth.users`, `auth.uid()`), apply `supabase/migrations/*.sql` in name order, and expose `asParent`, `asAnon`, `asService` and a helper that creates a user (returns its id and family id)
- [ ] 1.3 Write `supabase/tests/schema.test.ts` with one test per scenario in `specs/database-schema/spec.md`; verify it fails only because the migration and README do not exist yet

## 2. Implementation

- [ ] 2.1 Create `supabase/migrations/20261117000000_initial_schema.sql` with the 10 tables, keys, check constraints and indexes from design.md decision 2; verify the table, primary key, privacy and value constraint tests pass
- [ ] 2.2 Add `public.current_family_id()`, enable RLS on all tables, add the policies and the `devices` column privileges from decisions 3 and 4; verify the RLS tests pass
- [ ] 2.2b Add `public.purge_expired_pairing_code()` and the `before insert or update of code` trigger on `pairing_codes` (decision 7); verify the pairing code scenarios pass
- [ ] 2.3 Add `public.handle_new_user()` and the `after insert on auth.users` trigger (decision 5); verify the first sign-in tests pass
- [ ] 2.4 Write `supabase/README.md`: apply with `supabase link --project-ref <ref>` + `supabase db push` (or paste into the SQL editor), file naming, never edit an applied migration, run tests with `npm run check`; verify the README test passes

## 3. Verify

- [ ] 3.1 Run `npm run check` and `npm run build` and fix all failures without weakening tests
