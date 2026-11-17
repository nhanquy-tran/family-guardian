# Notes: add-digest-emails (#58)

## Test that needs a human decision

`supabase/tests/data-retention.test.ts` ("Migration is newer than every other migration and pins the retention period", line 162) asserts that `20261118120000_data_retention.sql` is the **last** migration file. Any later migration breaks it, so it is wrong as written (the "newer than every other migration" check belongs to the migration that was newest when #19 was built). I did not edit it. Suggested fix: assert only that the retention migration is newer than the ones before it (or drop the "last file" assertion). Until then `npm run check` fails on that one test; everything else passes (522 passed) and `npm run build` passes.

## What changed

- Migration `20261118120100_digest_emails.sql` (later of now `20261117151545` and newest on main `20261118120000` + 1 min): family digest columns with checks, column grant for `authenticated`, `digest_runs` (RLS on, no policy, rights revoked), `alerts.resolved_at`, `resolve_offline_alerts`, `purge_digest_runs`, `call_send_digests`, guarded cron jobs `send-digests` (every 15 min) and `purge-digest-runs`.
- `lib/digest/`: `schedule.ts`, `content.ts`, `send.ts`, `settings.ts`, `supabase-store.ts`; endpoint `POST /api/digest/send`.
- Offline endpoint only records and resolves incidents (no e-mail); `tokenMatches` is now exported and shared by both endpoints.
- `/dashboard/settings` (daily/weekly, hour, browser timezone via a hidden field), `TimezoneCapture` on `/dashboard`.
- `APP_URL` in `.env.example` and `docs/human-setup.md`.

## Deviations from the spec

- **Settings link is in the header, not in `<nav>`.** `components/dashboard-shell.test.ts` (from #40) fixes `DASHBOARD_NAV` to four items and the nav hrefs exactly, so adding a fifth nav item would break a test I may not edit. The link sits next to "Sign out". If the human wants it in the nav, update that test.

## How scenarios are verified

- Settings storage, claim key, resolve, purge, Vault handling, cron wiring: `supabase/tests/digest-emails.test.ts` (all pass).
- Due period: `schedule.test.ts`. Settings: `settings.test.ts`. Content: `content.test.ts`. Delivery, auth, config: `send.test.ts`, `route.test.ts`. Offline endpoint and store: `offline.test.ts`, `supabase-store.test.ts`.
- Cron on production and one real digest: manual after merge (migration PRs cannot be previewed, see platform notes).

## For the human to check

- `saveDigestSettings` sends an `update` without an explicit family filter (the fake client and the design rely on RLS `families_update`); confirm on production that it changes only the caller's row.
- Add Vercel env `APP_URL` and redeploy, or the digest endpoint answers 500.

## Docs to update

- `docs/architecture.md`: flow 6 (offline alerts now only record/resolve; a second 15-minute job sends the digest via `/api/digest/send`), the `alerts` row (new `resolved_at`; `emailed_at` unused), and the `families` row (new `timezone`, `timezone_known`, `digest_frequency`, `digest_hour`; new table `digest_runs`).
- `docs/platform-notes.md` (optional): mention that the PGlite "newest migration" assertion in data-retention is stale.

## Test arbitration

- `supabase/tests/data-retention.test.ts` > "Migration is newer than every other migration and pins the retention period": **test wrong**.
  - Scenario (add-data-retention design): the migration "must be newer than all existing files", i.e. at build time. It never says nothing may follow it.
  - Change: replaced `expect(files[files.length - 1]).toBe(file)` with checks that the retention migration sorts after `_offline_alerts.sql` (the newest file when it was built) and that the files after it are later-timestamped. The retention-period, job-name and schedule assertions are unchanged.
  - The earlier "Test that needs a human decision" note above is resolved by this change.
