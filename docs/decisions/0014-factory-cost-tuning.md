# 0014. Factory cost tuning

Date: 2026-11-17. Status: accepted (owner chose option 2).

## Context
Day 1 cost about $14 over 57 measured agent runs: spec writer on Opus 44% ($0.78 per spec), AI reviewer 29% (35 runs: it ran on every push to every PR plus manual re-runs), test writer and developer together 26% (about $0.50 per built item). Target: half or a third of that per item, keeping the factory autonomous.

Options considered: (1) write specs in the interactive Claude Code session on the owner's subscription, factory only builds (about a third of the cost, but uses the owner's interactive limits); (2) tune the factory (about half); (3) run the factory on a subscription token (near zero API cost, rejected: unattended bots stretch subscription terms and share the owner's 5-hour and weekly limits).

## Decision (option 2)
- Spec writer uses `claude-sonnet-5-5` by default (was Opus). `FACTORY_SPEC_MODEL` can switch back per need.
- AI reviewer runs once when a PR opens (or leaves draft), not on every push; re-review only via the `re-review` label or a manual dispatch; docs-only PRs are not reviewed.
- Lower turn caps: spec 30, test writer 30, developer 60, reviewer 15, `@claude` 30.
- Agents follow a context budget (read only what the change needs).
- `@claude` runs are serialized per issue/PR (no duplicate concurrent runs) and report their cost like the other agents.

## Consequences
- Expected about half the cost per item. Measure on the next 5 items via the dashboard; revisit option 1 if not reached.
- Claude's spec gate must watch spec quality on Sonnet; one extra fix round is cheaper than an Opus spec.
- After a `@claude` fix push, Claude adds `re-review` only when a fresh independent review is useful.
