# Proposal

Reconciles the source-of-truth spec after #58. Digest e-mails (#58, ADR 0016) replaced the per-incident offline e-mail from #18, but #58 added its requirements to its own `digest-emails` capability and did not modify `offline-alerts`. Archiving both left `offline-alerts` requiring behaviour the code no longer has (found when the factory archived all changes, 2026-11-18).

## What Changes
- `offline-alerts`: remove the per-incident e-mail, throttle and send-failure requirements; the fail-closed requirement no longer mentions mail configuration. Incident recording, resolution and the dashboard banner stay; e-mail is specified only in `digest-emails`.

## Out of scope
- Any code change: the code already matches (`apps/web/src/lib/alerts/offline.ts`).
