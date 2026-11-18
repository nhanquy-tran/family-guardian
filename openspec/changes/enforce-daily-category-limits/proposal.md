Depends on: #86
Touches: limit-enforcement, block-enforcement, daily-limits, domain-categories, packages/shared/src/index.ts

# Proposal

Implements GitHub issue #87 ("Extension enforces daily category limits").

## Why

#86 delivers `limits` and `timezone` to the device but nothing enforces them. A child must be blocked from a category for the rest of the day once its daily limit is used up, also offline.

## What Changes

- `RulesResponse` gains `categoryOverrides` (the family's own rows of `domain_categories`, at most `MAX_RULE_DOMAINS`, default `{}`); `GET /api/device/rules` fills it so devices categorize like the dashboard.
- Extension: counts today's active seconds per category locally (`categorize` with the overrides), resets at midnight in the family timezone, and when a category reaches its limit adds DNR redirect rules for that category's domains until the reset.
- The block page shows "Daily limit for <category> reached" (domain and category only).
- Blocked attempts on limit-blocked domains are recorded like other blocked attempts.
- No new permission, no new data sent to the server (ADR 0005 unchanged; per-category seconds stay in `chrome.storage.local`).

## Capabilities

- New: `limit-enforcement`
- Modified: `block-enforcement` (blocked attempts, re-pairing), `daily-limits` (rules contract, rules API)

## Out of scope

- Warnings before the limit, extra-time requests, per-weekday limits, dashboard display of limit usage.
- Enforcement while the device is `rejected` (401): rules stay as they are until the device recovers.
- Domains the child never visited and that no seed or override assigns to the category (blocked only once seen today).
