## Context

Architecture flow 5 defines the focus score per child per day and places it in `packages/shared`. Issue #6 fixes the exact formula. `packages/shared` already has the `UsageEntry` zod type (`minuteUtc` ISO string, `domain`, `seconds` 1..60) and Vitest runs from the root (`npm test`).

## Goals / Non-Goals

**Goals:** one pure, deterministic, dependency-free function with the behaviour in `specs/focus-score/spec.md`.

**Non-Goals:** category lookup, day/time-zone selection, persistence, UI (see proposal "Out of scope").

## Decisions

- **Signature**: `computeFocusScore(entries: readonly UsageEntry[], homeworkDomains: readonly string[]): FocusScore` where `FocusScore = { score: number | null; homeworkSeconds: number; totalSeconds: number; switches: number }`. Reusing `UsageEntry` keeps one entry shape across extension, API and score. The caller resolves categories to domains, since `domain_categories` lives in the database, not in `shared`.
- **Homework match**: exact string match against a `Set` of homework domains. Entries are already registrable domains (ADR 0005), so no suffix matching.
- **Minute grouping**: group entries by `minuteUtc` parsed with `Date.parse` (minute index = ms / 60000), sort minute keys ascending. The issue says input is ordered, but sorting is cheap and removes a class of caller bugs.
- **Mixed minute**: a minute is homework when homework seconds >= non-homework seconds. Majority reflects what the child mostly did; ties go to homework so a minute split evenly does not penalise the child.
- **Session gap**: a new session starts when the gap between consecutive minute indices is > 5. Exactly 5 stays in the session (issue: "more than 5 minutes apart").
- **Active hours**: `activeMinutes / 60`, with `activeMinutes` = distinct minutes with entries. Uses the same unit as switch detection. Never zero when `totalSeconds > 0`.
- **Rounding**: `Math.round` then clamp with `Math.min(100, Math.max(0, x))`. `Math.round` rounds .5 up; negative values are clamped anyway. Ensure the clamp never returns `-0` (use `Math.max(0, …)` after rounding, and tests compare with `toEqual`/`toBe(0)`).

## Test conventions

Every scenario in `specs/focus-score/spec.md` is a Vitest unit test in `packages/shared/src/focus.test.ts`. Unless a scenario says otherwise, the homework domains are `["khanacademy.org"]`, every entry has 60 seconds, and all minutes are on 2026-11-17 UTC (e.g. `2026-11-17T08:00:00.000Z`).

## Risks / Trade-offs

- [Minute granularity hides switches inside one minute] → Acceptable: the extension only reports per-minute data; matches the issue's definition.
- [A short day (few minutes) gets the full 20-point penalty from a single switch] → Accepted per the formula; the cap limits the damage.
- [Invalid `minuteUtc` strings] → Entries are validated by the zod contract at the API boundary; the function assumes valid input.
