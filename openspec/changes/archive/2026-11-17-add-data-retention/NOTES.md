# Notes: add-data-retention (#19)

## What changed
- `supabase/migrations/20261118120000_data_retention.sql`: indexes, `purge_old_data(p_now)` (security definer, service_role only), guarded `purge-old-data` cron job (daily 03:23 UTC).
- `apps/web/src/app/privacy/page.tsx`: accurate collected / never-collected lists, retention from `RETENTION_MONTHS`, no account self-deletion claim.
- `children-list.tsx`: confirmation now also mentions block history.
- `docs/human-setup.md`: cron check lists `purge-old-data`.

## Verification
- Purge, roles, no-pg_cron apply, rollback, cascade, RLS: `supabase/tests/data-retention.test.ts`.
- Privacy page: `privacy/page.test.tsx`; `/privacy` public: `redirects.test.ts`; confirmation: `children-list.test.ts`.
- `npm run check` and `npm run build` pass.

## For the human
- Migration timestamp: the real UTC time (20261117) is earlier than the existing `20261118110000_offline_alerts.sql`, so I used `20261118120000` to be newer than all files on main (required by the rule and the test).
- Confirmation wording: the existing test requires "This also deletes its devices and usage history." verbatim, so block history is a second sentence.
- After merge, check on production that `select jobname, schedule from cron.job;` lists `purge-old-data`, then `cron.job_run_details`.

## Docs to update
- `docs/architecture.md` "Retention" line: name the `purge-old-data` pg_cron job (`purge_old_data`, daily 03:23 UTC).
