# 0016. Digest e-mails replace per-incident offline e-mails

Date: 2026-11-18. Status: proposed (amends ADR 0010; needs human approval). Issue #58.

## Context
One e-mail per offline incident (ADR 0010) is noisy: a switched-off laptop looks like a removed extension. The owner decided parents get a digest instead.

## Decision
- The offline job keeps detecting and recording incidents (`alerts` rows, shown in the dashboard banner) but no longer e-mails. Each incident also records `resolved_at`, the time the next run noticed the device reporting again.
- A second `pg_cron` job every 15 minutes calls the web app (same Vault secrets as ADR 0010). The endpoint sends each family at most one digest per period via Resend.
- New stored data:
  - `families.timezone` (IANA name, default `UTC`), `families.timezone_known`, `families.digest_frequency` (`daily` or `weekly`, default `daily`), `families.digest_hour` (0-23, default 8). Parent configuration, per family; kept while the family exists and deleted with it.
  - `digest_runs(family_id, frequency, period_start, claimed_at)`: claim row that makes a digest once per family and period. No content, no addresses. Purged after 90 days by a daily purge job.
  - `alerts.resolved_at`: a timestamp on an existing table, same retention as `alerts`.
- The digest content (child names, device browser and OS, offline times, total time, focus score, top 3 domains) is computed on demand from data already stored under ADR 0005 and is never stored. Nothing new is collected from the child's device.
- Logs hold counts only. No identifiers are hashed, so no HMAC is needed.

## Consequences
- Parents learn of an offline laptop up to a day (or a week) later; the dashboard banner stays immediate.
- Per-parent preferences, SMS, push and unsubscribe links are out of scope.
