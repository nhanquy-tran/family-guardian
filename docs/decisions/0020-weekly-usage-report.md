# 0020. Weekly usage report e-mail

Numbered 0018 in its change (`add-weekly-usage-report`); renumbered because 0018 was already the factory light mode.

Date: 2026-11-18. Status: proposed (needs owner approval). Issue #90.

## Context
Parents want a weekly per-child summary (time, categories, domains, focus, trend). The digest (ADR 0016) already has the scheduler, claim table and Resend sender.

## Decision
- New stored data: `families.weekly_report_enabled` (boolean, default false). Parent configuration, per family; kept while the family exists and deleted with it.
- The report reuses `digest_runs` for its once-per-week claim with frequency `weekly_report`: no content, no addresses, purged after 90 days by the existing purge.
- The report runs inside the existing 15-minute `POST /api/digest/send` call; no new job, service or library.
- Report content (child names, domains, categories, times, focus score, change versus the previous week) is computed on demand from data stored under ADR 0005 and never stored. Nothing new is collected from the child's device.
- HTML is plain: no images, scripts or tracking pixels, one link to the dashboard. Logs hold counts only. No identifiers are hashed, so no HMAC is needed.

## Consequences
- Opt-in is per family, not per parent; there is no unsubscribe link (turn it off in settings).
- A family on a weekly digest receives two Monday e-mails.
