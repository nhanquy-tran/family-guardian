# Proposal

Implements GitHub issue #58 ("Digest e-mails: daily (default 08:00) or weekly on Monday").

## Why

One e-mail per offline incident is noisy (a switched-off laptop looks like a removed extension). The owner decided parents get a digest instead.

## What Changes

- Migration: `families.timezone`, `timezone_known`, `digest_frequency`, `digest_hour`; table `digest_runs` (claim per family and period); `alerts.resolved_at`; `purge_digest_runs()`; cron job `send-digests` every 15 minutes via `call_send_digests()` (guarded like #18).
- Settings page `/dashboard/settings`: Daily or Weekly (Monday) and send hour (default 8). The family timezone comes from the browser on save and on the first dashboard visit if unknown.
- Endpoint `POST /api/digest/send` (shared secret, fail closed): for each family whose latest due period is unclaimed, claim, build the digest, send to all parents via Resend, release the claim if every send failed.
- Digest per child: offline incidents (device, from to), active time, focus score, top 3 sites, dashboard link.
- The offline endpoint (#18) now only records and resolves incidents; it no longer e-mails. The dashboard banner is unchanged.
- ADR 0016 (proposed): new stored data and retention.

## Capabilities

### New Capabilities
- `digest-emails`: digest settings, scheduling, content and delivery, plus the offline endpoint no longer sending e-mail.

### Modified Capabilities
- `offline-alerts` (from #18, not yet synced into `openspec/specs`): e-mail sending and throttle removed; covered by the requirement "Offline endpoint records incidents without e-mail".

## Dependencies

Merged: #18, #12. Must be merged before building: #16 (`homeworkDomainsFor`, `children.homework_domains`), and ADR 0016 approved by the human.

## Out of scope

Per-parent preferences, SMS and push, unsubscribe links, changing the focus formula, digests for periods before the family existed, catching up more than the latest missed period.
