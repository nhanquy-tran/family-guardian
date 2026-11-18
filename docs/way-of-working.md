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
Owner: "do #N"  (or label #N autopilot: the scheduler starts it when its dependencies are specified)
  │
  ▼
Claude or the scheduler labels #N needs-spec ──▶ factory spec writer ──▶ spec PR + AI review
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
Claude labels #N build-now (only when its dependencies are merged),
or the scheduler does it for `autopilot` issues (ADR 0017)
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

## Long-running and stuck work

- **Factory watchdog** (`factory-watchdog.yml`, every 30 minutes): an agent run older than 60 minutes that finished no step for 30 minutes is cancelled and restarted; after 2 restarts the issue gets `needs-human`. A factory or spec PR that conflicts with main (GitHub then runs no PR checks at all) gets main merged automatically when clean, otherwise one `@claude` request to resolve it.
- **Claude's own waits** never wait on a single condition without a limit: every wait ends after at most 60 minutes, then Claude checks progress (run steps, PR head commit, mergeability, check list) and either continues, restarts the task, or reports. Waits poll at most once a minute (GitHub API budget).
- A PR whose head commit has no CI run after 15 minutes is treated as stuck: check mergeability first (conflict = no checks).

## Cost rules (ADR 0014)

- Spec writer on Sonnet; Claude's spec gate compensates.
- The AI reviewer runs once per PR. Claude adds the `re-review` label only when a fix changed behaviour or a gate needs fresh eyes.
- Prefer one combined fix request per round over several small `@claude` comments.

## Build gate checklist (Claude)

- Evidence table; CI, Vercel, migration dry run; AI review verdict (a skipped review is re-run).
- PR mergeable (a conflict means no checks ran).
- Test diff against the test-writer commit; `test-arbitrated` changes (made by the debugger) reviewed line by line against the scenario, with its `## Debugging` notes.
- Hidden acceptance tests pass and `VERIFY.md` says `VERIFY: PASS`; the change is archived into `openspec/specs/` in the same PR.
- Light mode (no verifier, no hidden tests): Claude builds the scenario → test → code matrix itself, and labels an issue `full-mode` before the build when it touches privacy, security, auth or existing data.
- Failing hidden tests: read `## Hidden test verdict` in NOTES.md. Verdict `test` or `spec`: fix the hidden test or the spec on the branch by the spec, label `test-arbitrated`, then archive. Verdict `code`: `@claude` fix on the PR (the hidden test stays as it is).
- After a gate fix or `@claude` round, wait for "Evidence (latest push)" to update before adding `re-review`.
- `## Test concerns` in NOTES.md (the developer's STOP rule) answered before merging.
- Live check where possible (preview, or production after merge for migration PRs).
- If the evidence says `Archive: skipped`, the gate fixes what blocked it and runs `npx openspec archive <change> -y` on the branch before merging (#105 was merged unarchived, which blocked #99's MODIFIED delta). Replace any `TBD` Purpose it writes.
- After merge: the nightly docs job (`factory-docs.yml`) applies `## Docs to update`; Claude reviews and merges its PR like any other.

## Where Claude works locally

- Never on the main checkout's `main`: every local change goes in a worktree under `.worktrees/<branch>` and reaches `main` through a PR (branch protection requires the CI `check` and `ci-build` jobs).
- Read the `Factory state` issue first in a new session: it lists every `autopilot` issue, its state and what it waits for.

## Records

- Every Claude gate decision is a PR comment starting `Gate (Claude):` with the verdict and reasons, so the audit trail stays in GitHub (Zühlke rule 3: every gate leaves evidence).
- Lessons go into [factory-learnings.md](factory-learnings.md).
