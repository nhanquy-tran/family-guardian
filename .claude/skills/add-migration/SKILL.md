---
name: add-migration
description: Add a Supabase SQL migration to this repo safely (naming, RLS, grants, guards, tests). Use whenever a change needs a database change.
---

1. **Name**: `supabase/migrations/<version>_<snake_name>.sql` where `<version>` is the later of `date -u +%Y%m%d%H%M%S` and the newest existing version plus one minute. Never reuse or edit an existing file (CI rejects it).
2. **Additive only**: `create`, `alter table ... add column`, new constraints on empty or compatible data. Drops and renames need an ADR and the owner.
3. **Tables**: `alter table ... enable row level security;` and policies limited to the parent's family (copy the pattern from `20261117000000_initial_schema.sql`). Parent-visible or editable columns on `children` / `devices` get explicit `grant select/insert/update (col)`.
4. **Functions**: `security definer` only when needed, always `set search_path = ''`, then `revoke execute on function ... from public, anon, authenticated;` and grant to `service_role` if the server calls it. Prefer `security invoker` for read functions so RLS applies.
5. **Cron / pg_net / Vault**: guard with an existence check so the PGlite harness still loads the file; verification happens on production after merge.
6. **Tests**: add scenarios in `supabase/tests/<area>.test.ts` using `supabase/tests/harness.ts` (roles `authenticated`, `service_role`, two families to prove RLS isolation).
7. Run `npx vitest run supabase/tests` and `bash .github/scripts/check-migrations.sh`.
