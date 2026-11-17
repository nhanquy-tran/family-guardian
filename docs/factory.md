# The AI factory

How Family Guardian is built: people set the target and decide at the gates, agents do the work, often overnight. Modelled on the Zühlke AI Factory production model (eight elements, five rules, six maturity steps) using only open-source parts. Decision: [ADR 0006](decisions/0006-ai-factory.md), auth and cost: [ADR 0007](decisions/0007-factory-auth-and-cost.md).

## Flow of one change

Current operating mode: **step 04, Claude as delegated gate**, see [way-of-working.md](way-of-working.md) and ADR 0013. The diagram below shows the gates; in step 04 Claude takes GATE 1 and GATE 2.

### Gates

```
Owner writes issue ──label needs-spec──▶ Factory 0 router ──▶ Factory 1: spec-writer agent
                                                               │ eval: spec structure + openspec validate --strict
                                                               │ opens PR "spec: …" (label spec, + needs-human if the eval failed)
                    Factory 4 reviewer ──▶ verdict as `factory/review` status + label
                    GATE 1 (human): review + merge spec PR ◀────┘
                                │
                    Factory 2 labels issue `ready`
                                │
   22:00 nightly (or label build-now, only once the issue is ready) ──▶ Factory 3: build
        1. test-writer agent writes failing tests from the scenarios   (checker ≠ producer)
        2. eval: those tests fail before implementation; every scenario has a test with its title
        3. developer agent implements until check + build pass
        4. gate: tests not weakened (deterministic diff check)
        5. eval: the same tests pass; gate: npm run check + npm run build
        6. PR with evidence table, label factory (+ needs-human if a gate or eval failed)
                                │
   CI (typecheck, lint, tests, build, gitleaks) ──▶ Factory 4: reviewer agent comments, verdict as status + label
                                │
                    GATE 2 (human): read evidence + review, merge in the morning
```

## Labels (state machine)

| Label | Meaning | Set by |
|---|---|---|
| `needs-spec` | Write a spec for this issue | Owner |
| `spec-in-progress` | Spec writer running | Factory |
| `spec-review` | Spec PR waiting for the owner | Factory |
| `ready` | Spec approved, queued for the nightly build | Factory (on spec merge) |
| `build-now` | Build this ready issue now | Owner |
| `in-progress` | Build running | Factory |
| `in-review` | PR open, waiting for the owner | Factory |
| `needs-human` | A gate failed or the agent has questions | Factory |
| `spec`, `factory` | PR types | Factory |
| `review-changes-needed` | The AI reviewer's latest verdict on the PR is "changes needed" (also the red `factory/review` status) | Factory 4 |
| `human-task` | Only the owner can do this (accounts, secrets, devices) | Owner |
| `area:*`, `bug` | Classification | Anyone |

## Mapping to the Zühlke AI Factory elements

| Element | Here |
|---|---|
| Agents | `.claude/agents/`: spec-writer, test-writer, developer, reviewer (Claude Code via `anthropics/claude-code-action@v1`) |
| Workflows | `.github/workflows/factory-*.yml` |
| Specification | OpenSpec: `openspec/changes/`, `openspec/specs/` |
| Knowledge | `CLAUDE.md`, `docs/architecture.md`, `docs/decisions/` |
| Code and Git | This GitHub repo |
| Traceability | Issue #n → `spec/n` PR → `openspec/changes/<name>` → `factory/n` PR (`Closes #n`) |
| QA and security | CI (`ci.yml`), test-first gate, tests-not-weakened gate, gitleaks, reviewer agent |
| Observability and metrics | Evidence table per PR (model, wall time, gates), metrics comment per agent step (cost, turns, time), control pane in `tools/factory-dashboard/`, Anthropic Console usage |

The five rules: (1) no agent approves its own work: only the owner merges; (2) the checker is not the producer: tests by a separate agent before implementation, deterministic gates before AI review; (3) every gate leaves evidence in the PR; (4) everything is a versioned file; (5) gateway: not used, see ADR 0007.

## Evals and evidence

Deterministic checks run by the workflow, not by the agent that produced the work. Each result goes in the PR's evidence table, and a failure adds `needs-human`.

| Eval | Where | Passes when |
|---|---|---|
| Spec structure | Factory 1, `.github/scripts/factory-eval.mjs spec` | proposal, design, tasks and spec files exist, every requirement has scenarios, every scenario has WHEN and THEN, `tasks.md` names a test file, `openspec validate --strict` passes |
| Tests fail first | Factory 3, on the test-writer commit | the new test files run and fail before any implementation (not on a syntax error, not "no test files found") |
| Scenario coverage | Factory 3, `factory-eval.mjs coverage` | every scenario title has a test named after it |
| Same tests pass | Factory 3, after the developer | the test-writer's files pass, so tests vitest does not pick up cannot slip through |
| AI review verdict | Factory 4, `.github/scripts/review-verdict.sh` | the reviewer ends its comment with `<!-- factory-review {...} -->`; the workflow sets the `factory/review` commit status and the `review-changes-needed` label from it |

The router refuses `build-now` on an issue whose spec is not approved yet (no `ready`, `in-review` or `needs-human`): it removes the label and comments instead of starting a build that fails.

The metrics comment of each agent step also lists the tool calls the agent was denied, so allowlists can be widened on evidence. `@claude` fix rounds (`claude.yml`) post one too, as agent `fixer`. Factory 1 and 3 runs are named with their issue number so the dashboard can attribute runs that failed before posting metrics.

## Configuration

Repo secrets: `CLAUDE_API_KEY` (required), `FACTORY_TOKEN` (recommended: fine-grained PAT on this repo with Contents, Issues, Pull requests read/write. Without it, PRs opened by the factory do not trigger CI and AI review; the build job still runs its own gates).

Repo variables (optional): `FACTORY_SPEC_MODEL` (default `claude-opus-5-5`), `FACTORY_BUILD_MODEL` and `FACTORY_REVIEW_MODEL` (default `claude-sonnet-5-5`), `FACTORY_MAX_PER_NIGHT` (default 3), `FACTORY_DEV_MAX_TURNS` (default 80).

Security on a public repo: only the owner's labels and `@claude` comments trigger agents; dispatch needs write access. Issue text is treated as data by the agents.

## Control pane (dashboard)

`tools/factory-dashboard/` is a static page (HTML, CSS, one JS file, no build) that shows and drives the factory from the browser:

- **Board**: open issues by factory label (backlog, `needs-spec` … `needs-human`, done), `human-task` issues apart, with the linked `spec/<n>` and `factory/<n>` PRs.
- **Specs**: `spec` PRs, their OpenSpec change folder and task progress from `tasks.md` (read from the open factory branch, the open spec branch, `main` or the archive).
- **Runs**: recent `Factory 1/3/4` and CI runs, with agent wall time today and this week.
- **Health**: per issue, the time of each step (spec writer, AI review, fixes, spec gate, queue, test writer, developer, AI review, fixes, build gate), Claude agent time, retries and end-to-end time; tiles for the median end to end, Claude time, retries per issue and merges over an AI "changes needed".
- **Issue timeline**: click an issue in Health or Cost for a Gantt chart of its steps, with `Gate (Claude):` decisions as markers, the retries (extra spec or build runs, `@claude` fix rounds, job re-runs) and every activity with its time and cost.
- **Cost**: per issue and step, today, this week and total. After each agent step the workflows run `.github/scripts/post-metrics.sh`, which reads the action's `execution_file` and comments `Factory metrics: … <!-- factory-metrics {json} -->` on the issue (or PR for the reviewer). The dashboard reads those comments, trusting only the owner, collaborators and `github-actions[bot]`.
- **Actions** (need a token, each behind a confirmation): squash-merge a PR (shows the evidence table, CI checks, commit statuses and the AI review first, needs an explicit tick, worded as an override when the review is not "looks good"), add `needs-spec` or `build-now`, re-run failed jobs, comment.

Where: GitHub Pages, deployed by `dashboard-pages.yml` on every push to `main` that touches the folder (one-time setup: Settings > Pages > Source: GitHub Actions). It also works locally: open `tools/factory-dashboard/index.html`, or serve the folder with any static server. `?repo=owner/name` points it at another repo.

Token: read-only views work without one (60 GitHub API calls per hour per IP, about 12 per refresh). For actions and higher limits, paste a **fine-grained personal access token for this repository only** with read/write on **Actions, Contents, Issues and Pull requests** (Metadata read is added automatically). It is stored in the browser's `localStorage`, sent only to `api.github.com`, never committed, and removed with "Forget token". Give it a short expiry. Labels and merges made with it are the owner's own actions, so the router still accepts them.

## Writing a good issue for the factory

- One user-visible outcome per issue, small enough for one night.
- Acceptance criteria as bullet points; the spec writer turns them into scenarios.
- Name the area (`area:web`, `area:extension`, `area:infra`) and any dependency (`Depends on #n`).

## Learn loop

When a gate or the human catches something an earlier step should have caught, add a row to [factory-learnings.md](factory-learnings.md) and turn it into a rule in the relevant `.claude/agents/*.md` file. The spec writer and reviewer read both.

## When to stop the review loop

The reviewer can always find something. A PR is ready for the human gate when it has **no high or medium findings**; low and info findings are optional and may be fixed later. At most two fix rounds per PR; after that the human decides.
