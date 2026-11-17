# Proposal: Privacy policy page and data retention

Implements GitHub issue #19. Needed for the Chrome Web Store listing.

## Why
The store listing needs a public privacy policy that matches what the product really does, and the 13-month retention in `docs/architecture.md` is promised but nothing deletes old data yet.

## What exists already (on main)
- `/privacy` page (`apps/web/src/app/privacy/page.tsx`), public (outside the proxy matcher), with a first draft.
- Delete child with a confirmation step naming devices and usage history (`children-list.tsx`, `deleteChild`); FK cascades remove devices, usage, block events, rules, pairing codes and alerts.

## What changes
1. **Retention job**: a new migration adds `purge_old_data(p_now)` deleting `usage_minutes` and `block_events` older than 13 months, scheduled daily with `pg_cron` (guarded like #18; ADR 0010 pattern). No new stored data, so no new ADR.
2. **Privacy page**: make it accurate and testable: lists collected data (domain, seconds, blocked domain with time, browser/OS/extension version), what is never collected, 13-month retention, and how to delete. Remove the claim that a parent can delete the whole family account (not built); say account deletion is by request via the contact link.
3. **Tests** for the page and for the delete-child scenarios (existing tests are kept, gaps filled).

## Out of scope
- Family/account self-service deletion, data export.
- Purging `alerts` rows, `pair_attempts` (already purged), or any other table.
- Cookie banner, terms of service, translations.
- Changing what is collected (ADR 0005 unchanged).

## Depends on
#38 schema, #10 heartbeat/usage data, #18 offline alerts (cron guard pattern; its migration must be on main so the new migration is newer). All merged.
