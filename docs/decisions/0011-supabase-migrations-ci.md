# 0011. Supabase migrations applied by CI

Date: 2026-11-17. Status: accepted.

## Context
SQL migrations live in `supabase/migrations/`. Applying them by hand after each merge is easy to forget and breaks the deployed app.

## Decision
`.github/workflows/supabase-migrate.yml` uses the Supabase CLI:
- On PRs touching `supabase/**`: `supabase db push --dry-run` against the live project, output in the run summary (a gate the human can read before merging).
- On merge to `main`: `supabase db push` applies pending migrations.
Secrets: `SUPABASE_ACCESS_TOKEN` (personal access token) and `SUPABASE_DB_PASSWORD`. Project ref `gorggbnaidjszwhkzkzr` (overridable with repo variable `SUPABASE_PROJECT_REF`).

## Consequences
- One database (production) for the MVP; no separate staging. Migrations must be additive and safe; never edit an applied migration.
- Destructive changes (drop column/table) need an ADR and a human check of the dry run.
- Vercel deploys and migrations run independently; code must tolerate the migration landing a minute before or after the deploy.
