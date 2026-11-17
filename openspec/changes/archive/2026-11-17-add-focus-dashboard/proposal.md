# Proposal

Implements GitHub issue #16 ("Focus score on the dashboard and homework settings").

## Why

`computeFocusScore` (#6) and categories (#5) exist, but parents cannot see the score or say what counts as homework. `children.homework_categories` exists in the schema and has no UI; there is no place for extra homework sites.

## What Changes

- Migration: `children.homework_domains text[]` (validated, max 50, parent-editable), default `homework_categories` for new children becomes `{education}`, and existing children with an empty list get `{education}` (no UI ever wrote it, so empty means "never chosen").
- Pure function `homeworkDomainsFor(usageDomains, settings)` in `packages/shared/src/homework.ts`: resolves categories and extra domains to the homework domain list that `computeFocusScore` needs.
- Page `/dashboard/children/[childId]/homework`: choose homework categories, add or remove extra domains. Link per child.
- Overview `/dashboard`: per child, today's focus score (0-100) with homework time, other time and switches, a 7-day trend, and a short "how is this calculated" text.
- Day boundaries use the parent's browser timezone from `?tz=` exactly as in #12 (not stored, no ADR).

## Capabilities

### New Capabilities
- `focus-dashboard`: homework settings and the focus score overview.

### Modified Capabilities
None.

## Dependencies

Must be merged first: #5 (categories), #6 (focus score function), #7 (schema), #9 (children page), #10 (heartbeat: column grants), #14 (`normalizeBlockDomain`), and #12 (timezone helpers `resolveTimezone`, `dayRangeUtc`, `localDay` and `TimezoneSync`). Do not build before #12 is merged.

## Out of scope

- Changing the formula, storing computed scores, notifications about low scores.
- Family-wide category overrides (`domain_categories` editing).
- Past-day navigation, ranges other than the last 7 days.
- Sending homework settings to the extension (no `rules_version` bump).
- New data collection: ADR 0005 is unaffected. `homework_domains` is parent configuration like `block_rules`, not data about the child, so no new ADR.
