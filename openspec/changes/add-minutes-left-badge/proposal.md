Depends on: #87
Touches: limit-badge, block-enforcement, apps/extension/lib/controller.ts, apps/extension/lib/limits.ts

# Proposal

Implements GitHub issue #88 ("Minutes left" badge on the extension icon).

## Why

A child who hits a daily category limit is surprised by the block page. A badge with the minutes left shows it coming.

## What Changes

- The extension action badge shows the whole minutes left (`5`…`1`) for the active tab's category while that category has a limit and 5 minutes or less are left; otherwise it is empty.
- Amber background. Updated on every tracker event and on every 1-minute alarm.
- Reads only the local state #87 stores (`rulesLimits`, `rulesOverrides`, `rulesTimezone`, `limitUsage`); no new permission (the `action` badge API needs none, but the manifest gains an `action` key), nothing sent to the server (ADR 0005 unchanged).

## Capabilities

- New: `limit-badge`

## Out of scope

- Warnings other than the badge (notifications, block-page countdown), badge for manual blocks, tooltip text.
- Counting the current, not yet completed minute (the badge lags up to 2 minutes, like #87 enforcement).
- Usage in other browsers on the same laptop (each browser shows its own usage).
