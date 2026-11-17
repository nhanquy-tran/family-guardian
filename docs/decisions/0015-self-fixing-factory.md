# 0015. Self-fixing factory: arbiter, watchdog, shared platform knowledge

Date: 2026-11-18. Status: accepted (owner delegated factory improvements to Claude).

## Context
Day 2 review of the factory runs: 5 builds, 2 of them blocked on impossible tests written by the test writer (#11, #13); 1 killed by a turn cap after finishing (#9); 1 stalled silently by a merge conflict (no checks run); 5 specs needed gate fixes for platform facts the agents did not know (row limits, migration ordering, guest mode, alert noise, queue size).

## Decision
1. **Test arbiter** (`.claude/agents/arbiter.md`, step in `factory-build.yml`): when gates fail and tests were not weakened, an independent agent decides per failing test, by the spec, whether the test or the code is wrong; it may change only failing test files and NOTES.md, once per build; changes are labelled `test-arbitrated` for the gate.
2. **Watchdog** (`factory-watchdog.yml`): restarts stalled runs, merges main into conflicting factory/spec PRs or asks `@claude` (ADR-level rule: no silent stalls).
3. **Platform notes** (`docs/platform-notes.md`): shared knowledge every agent reads; new surprises are added there.
4. **Agent rules**: build-time migration timestamps, follow main when a spec is stale, no edits to `docs/architecture.md` by factory agents (docs listed in NOTES, applied by Claude after merge), specs above ~30 scenarios are split, test writers show computed expectations.

## Consequences
- Fewer gate interventions and idle time; builds that fail on a wrong test fix themselves with evidence.
- Arbitrated test changes are still reviewed by the gate (label).
- Architecture doc updates move to the gate step after merge.
