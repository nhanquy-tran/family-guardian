Depends on: none
Touches: weekly-report, digest-emails, `supabase/migrations`, `packages/shared/src/index.ts`

# Weekly usage report e-mail for parents (#90)

## Why
Parents get a daily or weekly digest focused on offline incidents and a top-3 site list. They also want a weekly summary of each child's browsing: time, categories, domains, focus and the trend against the week before.

## What changes
- New opt-in family setting `weekly_report_enabled` (default off), edited on `/dashboard/settings` ("Weekly report").
- A report is sent every Monday at the family's `digest_hour` in the family timezone, covering the previous Monday to Sunday, to all parents of the family.
- Per child: total time, top 5 categories, top 5 domains, average focus score, change in total time versus the week before. No data: "No activity this week".
- HTML part (plain, accessible, no images or tracking pixels) plus a text part.
- Runs inside the existing `POST /api/digest/send` call of the 15-minute `send-digests` cron job and the Resend sender. Same auth and fail-closed configuration.
- Idempotent per family and week: claim row in the existing `digest_runs` table with frequency `weekly_report` (no new table; the existing 90-day purge applies).
- New SQL function `usage_total_seconds` for the prior-week total (aggregated in SQL, see platform notes).
- ADR 0018 (new stored setting, report content computed on demand, claim reuse).

## Out of scope
Per-parent opt-in, unsubscribe links, a separate send hour, charts or images, category overrides (seed categories only), changing the digest e-mails, backfilling missed older weeks (only the latest week is sent, like the digest).
