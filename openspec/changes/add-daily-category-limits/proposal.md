Depends on: none
Touches: daily-limits, site-blocking, packages/shared/src/index.ts, supabase/migrations

# Proposal

Implements GitHub issue #86 ("Daily time limits per category: storage, parent UI and rules API").

## Why

Parents want a daily time limit per category for each child (games 60 min, video 90 min). This change stores the limits, lets the parent edit them and delivers them to the extension. Enforcement is a separate issue.

## What Changes

- Migration: table `child_category_limits (child_id, category, minutes_per_day)`, primary key `(child_id, category)`, minutes 5 to 1440, RLS limited to the parent's family, cascade on child delete, trigger that reuses the existing `bump_rules_version()` so a change bumps `children.rules_version`.
- `apps/web/src/lib/daily-limits.ts`: list and save limits (validate everything first, fail closed with error codes).
- Rules page: a "Daily limits" card (`DailyLimitsCard`) with one minutes input per category (empty = no limit) and a server action.
- `RulesResponse` gains `limits: [{ category, minutesPerDay }]` and `timezone` (the family's); `GET /api/device/rules` fills them. Both are optional/defaulted in the schema so older extensions and fixtures keep parsing.

## Capabilities

### New Capabilities
- `daily-limits`: storage, validation, parent card, rules API fields.

### Modified Capabilities
- `site-blocking`: requirement "Rules API for devices" returns `limits` and `timezone`.

## Out of scope

- Enforcement in the extension, counting time against limits, any child-facing message.
- Bumping `rules_version` when the family timezone changes (devices pick the new timezone on the next rules refetch).
- New dependencies, ADRs or data collected from the extension (privacy unchanged, ADR 0005).
