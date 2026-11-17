# Supabase

## Migrations

SQL migrations live in `supabase/migrations`, named `<14-digit timestamp>_<name>.sql` (for example `20261117000000_initial_schema.sql`) and applied in name order.

Never edit a migration that has been applied; add a new file with a later timestamp instead.

### Apply to the hosted project

```
supabase link --project-ref <ref>
supabase db push
```

Alternatively paste the file into the Supabase SQL editor. After applying, check the Supabase security advisor.

## Tests

Schema tests run against PGlite (Postgres in WASM, no Docker) with a small Supabase stand-in (roles, `auth.users`, `auth.uid()`). They apply every file in `supabase/migrations` and run as part of `npm run check`.
