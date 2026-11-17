# Way of working: owner, Claude and the factory

Decided 2026-11-17 ([ADR 0013](decisions/0013-claude-as-delegated-gate.md)). The owner works with Claude on the backlog only. Claude drives the factory and takes the human gates on the owner's behalf, within the limits below. Zühlke AI Factory step 04, "human above the loop": the owner sets the goal and handles exceptions.

## Roles

| Who | Does |
|---|---|
| Owner | Picks backlog items ("do #11"), answers escalations, makes product decisions, does human-only tasks (accounts, secrets, devices) |
| Claude (interactive session) | Triggers the factory, critically reviews specs and builds, decides fixes, merges when the quality bar is met, escalates when a limit is hit |
| Factory agents | Spec writer, test writer, developer, reviewer (GitHub Actions) |

## Flow for one backlog item

```
Owner: "do #N"
  │
  ▼
Claude labels #N needs-spec ──▶ factory spec writer ──▶ spec PR + AI review
  │
  ▼
SPEC GATE (Claude replaces the owner)                     max 3 fix rounds
  Claude reviews the spec critically (issue fit, ADRs, learnings checklist,
  testable scenarios, failure paths, privacy, security, dependencies)
  ├─ high/medium issues ─▶ @claude fix request on the PR ─▶ re-review ─▶ (loop)
  ├─ 3 rounds and still not agreed ─▶ STOP, summary to owner
  └─ no high/medium ─▶ Claude merges the spec PR ─▶ issue becomes ready
  │
  ▼
Claude labels #N build-now (only when its dependencies are merged)
  ──▶ factory build: test writer, developer, gates, PR with evidence, CI, AI review
  │
  ▼
BUILD GATE (Claude)                                         max 2 build attempts
  Claude reviews end to end: evidence table, CI + Vercel preview, diff against
  spec and issue, tests not weakened, security/privacy, migration dry run,
  and runs it where possible (preview URL, local build)
  ├─ critical/medium issues ─▶ Claude decides the fix: @claude on the PR, or
  │                            spec change + rebuild ─▶ attempt 2
  ├─ still failing after attempt 2 ─▶ STOP, summary to owner
  └─ OK ─▶ Claude merges (see limits) and reports
```

## Limits (when Claude stops and hands back)

1. **Spec:** 3 fix rounds without reaching "no high/medium findings".
2. **Build:** the 2nd build attempt still fails a gate or Claude's review. Failures caused by the factory itself (infrastructure, workflow bugs) are fixed in the factory and do not count as an attempt.
3. **Always escalate**, regardless of rounds:
   - a new ADR or an ADR amendment that changes privacy or security (ADR 0005, 0012-style decisions); Claude may draft it, the owner approves;
   - destructive database migrations (drop, rename, data deletion);
   - new paid services, new secrets or accounts;
   - anything that needs the owner's accounts or devices.
4. **Spending:** a single item costing more than about $10 in agent runs is reported before continuing.

## Escalation summary format

When Claude stops, it posts the same summary on the issue and in chat:
- what was attempted (rounds, links to PRs and runs);
- the open findings, with Claude's view on each;
- the options and Claude's recommendation;
- cost and time spent.

## Cost rules (ADR 0014)

- Spec writer on Sonnet; Claude's spec gate compensates.
- The AI reviewer runs once per PR. Claude adds the `re-review` label only when a fix changed behaviour or a gate needs fresh eyes.
- Prefer one combined fix request per round over several small `@claude` comments.

## Records

- Every Claude gate decision is a PR comment starting `Gate (Claude):` with the verdict and reasons, so the audit trail stays in GitHub (Zühlke rule 3: every gate leaves evidence).
- Lessons go into [factory-learnings.md](factory-learnings.md).
