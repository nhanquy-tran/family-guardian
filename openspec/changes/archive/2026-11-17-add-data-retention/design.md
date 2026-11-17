# Design

## 1. Retention function
Migration `supabase/migrations/<build-time UTC timestamp>_data_retention.sql` (the developer runs `date -u`; it must be newer than all existing files):

```sql
create function public.purge_old_data(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = ''
```
- Deletes `usage_minutes where minute_utc < p_now - interval '13 months'` and `block_events where at < p_now - interval '13 months'`; returns `{"usage_minutes": n, "block_events": m}`.
- `revoke execute ... from public, anon, authenticated`; `grant execute ... to service_role`.
- Adds indexes `usage_minutes (minute_utc)` and `block_events (at)`: the primary key and the existing index lead with `device_id`, so the delete would otherwise scan the table.
- A row exactly at the cutoff is kept (strict `<`).

## 2. Schedule
Guarded `do $$` block as in the offline-alerts migration: only if `pg_cron` is available, `cron.schedule('purge-old-data', '23 3 * * *', 'select public.purge_old_data(now())')`. Scheduling the same name again updates it, so it is idempotent. Not testable in PGlite; verified on production after merge (`select jobname, schedule from cron.job;`, then `cron.job_run_details`).

## 3. Failure behaviour
If a delete errors, the function's transaction rolls back, pg_cron records the failure in `cron.job_run_details`, and the next daily run retries. Nothing is partially deleted. No data leaves the database and no secret is involved.

## 4. Privacy page
Static server component, no data fetching. A render test makes string assertions. The retention number comes from `RETENTION_MONTHS = 13` in `apps/web/src/lib/retention.ts`, used by the page. The SQL uses the same literal, and a PGlite test pins it.

## 5. Delete child
Already implemented; the spec requires it so regressions are caught. The confirmation text must name the child, devices, usage history and block history.

## 6. Docs
Update the `docs/architecture.md` retention line (job name, daily 03:23 UTC) and `docs/human-setup.md` (check that `cron.job` lists `purge-old-data`).
