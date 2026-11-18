# 0019. Factory waste cuts: time limits, spec lint, docs queue, Dependabot triage

Date: 2026-11-18. Status: accepted (owner approved R1–R5 of the factory audit v5).

## Context
The audit of 56 light-mode agent runs (`docs/reports/factory-architecture-audit.html`, v5) found: a third of the spend per item was rework; about 230 tool calls were denied, 150 of them `cd … &&` prefixes the allowlists do not match; `--max-turns` never stopped a run (test writer capped at 30 averaged 37, developer capped at 50 reached 64) and only failed the step afterwards, which discarded the docs agent's finished work; every light-mode spec needed a gate round for the same mechanical findings; the docs job never succeeded; Dependabot PRs had no owner; five source-of-truth specs failed `--strict` on main.

## Decision
1. Agent steps have no `--max-turns`; each has a step `timeout-minutes` (about 2–3× the longest run seen) and keeps `continue-on-error` where finished work must survive. Every allowlist includes `Bash(cd:*)`, and every agent file says to run commands from the repository root.
2. `factory-eval.mjs spec` also runs `spec-lint.mjs`: `Depends on` and `Touches` lines, every delta capability in `Touches`, ADDED only for new requirement names, MODIFIED/REMOVED only for existing ones, `## Purpose` for a new capability, at most 20 scenarios (light) or 30 (full), and a warning when another open change modifies the same requirement. The spec writer runs it before finishing.
3. CI's required `check` job also runs `openspec validate --specs --strict`. The debugger treats lint and type errors as failures.
4. The docs job works through a queue: `docs/docs-notes-applied.txt` lists handled changes; each run takes at most 5 changes, skips while a docs PR is open, opens its PR even when the agent stops early, and opens a `needs-human` issue on failure.
5. Dependabot patch and minor updates auto-merge once the required checks pass; major updates get `needs-human`. This is the one exception to "every merge goes through the gate" (ADR 0013): those updates change no product code and still pass `check`, `ci-build`, CodeQL and the secrets scan.
6. The dashboard shows rework share, gate fix rounds per issue and denied tool calls per run.

## Consequences
- Expected: cost per item from about $2.14 to about $1.60, spec gate rounds from 8 in 8 to 3 or fewer, measured on the next light-mode items.
- A runaway agent is bounded by time, not turns; cost per run is still visible in the metrics.
- Auto-merge needs the repository setting "Allow auto-merge" (owner); without it the workflow comments instead.
