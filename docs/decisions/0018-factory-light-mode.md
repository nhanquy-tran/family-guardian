# 0018. Factory light mode for the heavy build phase

Date: 2026-11-18. Status: accepted (owner asked to cut token cost per issue by a third to a half while features are being built).

## Context
Agent cost per issue rose from about $1.6 (MVP median, 21 issues) to about $2.2–2.5 with the ADR 0017 pipeline (#65: $4.63 including a factory-caused rebuild). Measured on #65: the developer took 101 turns and 43 separate edits ($0.82; a third each cache writes, cache reads and output); spec writer and test writer cost $0.4–0.5 each; verifier, two review stages and spec-PR reviews add about $0.5. Claude's own spec and build gates already review every spec and check the scenario matrix, so several agent steps duplicate them.

## Decision
A repo variable `FACTORY_MODE` (`light` or `full`, default `full`) switches the pipeline. Light mode:
- Spec writer: at most 20 scenarios, short design and tasks (turn cap 30 as in full mode: 20 cut off a finished spec, #87).
- No AI review on spec PRs (the spec gate reviews them).
- Test writer: no hidden acceptance tests, one test per scenario, 30 turns.
- Developer: 50 turns (efficiency rules apply in both modes: whole-file writes, few edits, targeted test runs, check and build once at the end).
- No verifier; the build gate checks the scenario matrix and archives.
- One combined review stage on code PRs (spec compliance plus clear correctness bugs).
Unchanged in both modes: test-first, tests-not-weakened, check and build, the debugger on failure, CI, CodeQL and the gates.

Full mode stays for risky changes: privacy, security, auth, migrations that change existing data, and anything the gate escalates. The gate may build a single issue in full mode by labelling it `full-mode` before `build-now` (the router passes it). Not adopted: a cheaper model per role; it is the owner's choice and can be set through the existing `FACTORY_*_MODEL` variables.

Update 2026-11-18: turn caps are replaced by step time limits (ADR 0019); `--max-turns` never stopped a run.

## Consequences
- Expected about $1.2–1.4 per issue (−40 to −45 %), measured on the first light-mode issues and reported in `docs/factory-learnings.md`.
- Weaker independent checks: no hidden tests and no verifier, so the gate's own review matters more. Escalation rules (ADR 0013) are unchanged.
