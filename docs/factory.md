# The AI factory

How Family Guardian is built: people set the target and decide at the gates, agents do the work, often overnight. Modelled on the Zühlke AI Factory production model (eight elements, five rules, six maturity steps) using only open-source parts. Decision: [ADR 0006](decisions/0006-ai-factory.md), auth and cost: [ADR 0007](decisions/0007-factory-auth-and-cost.md).

## Flow of one change

Current operating mode: **step 04, Claude as delegated gate**, see [way-of-working.md](way-of-working.md) and ADR 0013. The diagram below shows the gates; in step 04 Claude takes GATE 1 and GATE 2.

### Gates

Factory upgrade: [ADR 0017](decisions/0017-factory-upgrade-specs-verify-scheduler.md).

```
Owner writes issue (Depends on: #a, #b) ──label autopilot──▶ Factory 6 scheduler (every 30 min, on merges)
   or label needs-spec by hand                                │ dependencies specified? parallel limit (3)?
                                                              ▼
                     Factory 0 router ──▶ Factory 1: spec-writer (reads openspec/specs/, writes ADDED/MODIFIED/REMOVED)
                                                               │ eval: spec structure + openspec validate --strict
                     Factory 4 review, stage 1 (spec) ──▶ GATE 1 (Claude, ADR 0013): merge spec PR
                                │
                     Factory 2 labels issue `ready` ──▶ scheduler: dependencies merged? no Touches overlap? ──▶ build-now
                                │
   Factory 3: build
        1. test-writer: visible tests + hidden acceptance tests (acceptance/<change>/)
        2. evals: visible and hidden tests fail first; every scenario has a test; hidden tests removed from the tree
        3. developer (cannot edit tests, applied migrations, architecture, .env); lint auto-fix
        4. gates: tests not weakened, npm run check + build, same tests pass
        5. debugger (only if gates fail): systematic debugging, code/test/spec, max 3 attempts
        6. gate: hidden acceptance tests restored and run
           if they fail: debugger in hidden-test mode proposes code / test / spec per failure (NOTES only)
        7. verifier: openspec verify → VERIFY.md; all pass → openspec archive into openspec/specs/
        8. PR with evidence table (+ needs-human if anything failed)
                                │
   CI (check, build, gitleaks, migration checks, CodeQL) ──▶ Factory 4 review: stage 1 spec, stage 2 quality
                                │
                    GATE 2 (Claude, ADR 0013): read evidence + review, merge
                                │
   Factory 8 evidence (every later push to a factory PR): recomputes tests, coverage, hidden tests,
        verify and archive rows into "Evidence (latest push)" in the PR body
   Factory 7 docs (nightly): applies "Docs to update" notes, 5 changes per run, queue in
        docs/docs-notes-applied.txt ──▶ docs PR
   Dependabot triage: patch/minor auto-merge on green checks; majors get needs-human (ADR 0019)
```

### Light and full mode (ADR 0018)

The repo variable `FACTORY_MODE` picks the pipeline; `light` is used during the heavy build phase.

| Step | Full | Light |
|---|---|---|
| Spec writer | as above | ≤ 20 scenarios, short design and tasks (30 turns, as full) |
| AI review of spec PRs | stage 1 | none (Claude's spec gate) |
| Test writer | visible + 3–6 hidden tests | visible tests only, 30 turns |
| Developer | 70 turns | 50 turns |
| Verifier, hidden-test gate | run | skipped (`skipped (light mode)` in the evidence) |
| AI review of code PRs | spec compliance, then quality | one combined stage |

A `full-mode` label on an issue builds that issue in full mode. Use it for privacy, security, auth and data-changing migrations.

## Labels (state machine)

| Label | Meaning | Set by |
|---|---|---|
| `autopilot` | Let the scheduler specify and build this issue in dependency order | Owner |
| `needs-spec` | Write a spec for this issue | Owner or scheduler |
| `spec-in-progress` | Spec writer running | Factory |
| `spec-review` | Spec PR waiting for the owner | Factory |
| `ready` | Spec approved, queued for the nightly build | Factory (on spec merge) |
| `build-now` | Build this ready issue now | Owner or scheduler |
| `in-progress` | Build running | Factory |
| `in-review` | PR open, waiting for the owner | Factory |
| `needs-human` | A gate failed or the agent has questions | Factory |
| `spec`, `factory` | PR types | Factory |
| `review-changes-needed` | The AI reviewer's latest verdict on the PR is "changes needed" (also the red `factory/review` status) | Factory 4 |
| `test-arbitrated` | The debugger changed a test; the gate checks it | Factory 3 |
| `re-review` | Run the AI review again on the latest push | Owner or Claude |
| `factory-state` | The single issue the scheduler rewrites with the current state | Factory 6 |
| `human-task` | Only the owner can do this (accounts, secrets, devices) | Owner |
| `area:*`, `bug` | Classification | Anyone |

## Mapping to the Zühlke AI Factory elements

| Element | Here |
|---|---|
| Agents | `.claude/agents/`: spec-writer, test-writer, developer, debugger, verifier, spec-reviewer, quality-reviewer, docs-writer (Claude Code via `anthropics/claude-code-action@v1`) |
| Workflows | `.github/workflows/factory-*.yml` |
| Specification | OpenSpec: `openspec/specs/` is current behaviour (source of truth), `openspec/changes/` is work in progress, archived on a passing build |
| Knowledge | `CLAUDE.md` index + area `CLAUDE.md` files, skills in `.claude/skills/`, `docs/platform-notes.md`, `docs/decisions/README.md` |
| Code and Git | This GitHub repo |
| Traceability | Issue #n → `spec/n` PR → `openspec/changes/<name>` → `factory/n` PR (`Closes #n`) |
| QA and security | CI (`ci.yml`), CodeQL, Dependabot, test-first gate, tests-not-weakened gate, hidden acceptance tests, verify gate, gitleaks, two-stage review, branch protection on `main` |
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
| Hidden acceptance tests | Factory 3, after the developer (and debugger) | the tests in `acceptance/<change>/`, which the developer never saw, pass |
| Hidden test verdict | Factory 3, debugger in hidden-test mode, only when hidden tests fail | a proposal, not a gate: `HIDDEN VERDICT: code / test / spec / mixed` in NOTES.md and the evidence table; the gate decides |
| OpenSpec verify | Factory 3, verifier agent | `VERIFY.md` starts with `VERIFY: PASS`; only then the change is archived into `openspec/specs/` |
| Evidence (latest push) | Factory 8, `.github/scripts/refresh-evidence.mjs` on every push to a `factory/*` PR | not a gate: keeps the evidence current after gate fixes and `@claude` rounds; reviewers judge this section |
| AI review verdict | Factory 4, `.github/scripts/review-verdict.sh` | the reviewer ends its comment with `<!-- factory-review {...} -->`; the workflow sets the `factory/review` commit status and the `review-changes-needed` label from it |

The router refuses `build-now` on an issue whose spec is not approved yet (no `ready`, `in-review` or `needs-human`): it removes the label and comments instead of starting a build that fails.

The metrics comment of each agent step also lists the tool calls the agent was denied, so allowlists can be widened on evidence. `@claude` fix rounds (`claude.yml`) post one too, as agent `fixer`. Factory 1 and 3 runs are named with their issue number so the dashboard can attribute runs that failed before posting metrics.

## Configuration

Repo secrets: `CLAUDE_API_KEY` (required), `FACTORY_TOKEN` (recommended: fine-grained PAT on this repo with Contents, Issues, Pull requests read/write. Without it, PRs opened by the factory do not trigger CI and AI review; the build job still runs its own gates).

Repo variables (optional): `FACTORY_SPEC_MODEL`, `FACTORY_BUILD_MODEL` and `FACTORY_REVIEW_MODEL` (default `claude-sonnet-5-5`), `FACTORY_MAX_PER_NIGHT` (default 3), `FACTORY_MAX_PARALLEL` (scheduler, default 3), `FACTORY_MODE` (`light` or `full`, default `full`), `FACTORY_DEV_MAX_TURNS` (default 70, 50 in light mode).

Agents never get `FACTORY_TOKEN` in their shell: the workflow does the pushes, PRs and labels. Only the owner-triggered `@claude` job keeps it, with a tool allowlist.

Security on a public repo: only the owner's labels and `@claude` comments trigger agents; dispatch needs write access. Issue text is treated as data by the agents.

## Control pane (dashboard)

`tools/factory-dashboard/` is a static page (HTML, CSS, one JS file, no build) that shows and drives the factory from the browser. It follows the [style guide](design/style-guide.md); the Pages deploy copies `docs/design/tokens.css` and `icon.svg` into it.

- **Board**: open issues by factory label (backlog, `needs-spec` … `needs-human`, done), `human-task` issues apart, with the linked `spec/<n>` and `factory/<n>` PRs.
- **Specs**: `spec` PRs, their OpenSpec change folder and task progress from `tasks.md` (read from the open factory branch, the open spec branch, `main` or the archive).
- **Runs**: recent `Factory 1/3/4` and CI runs, with agent wall time today and this week.
- **Health**: per issue, the time of each step (spec writer, AI review, fixes, spec gate, queue, test writer, developer, verifier, AI review, debugger and fixes, build gate), Claude agent time, retries and end-to-end time; tiles for the median end to end, Claude time, retries per issue and merges over an AI "changes needed".
- **Workflow**: an interactive map of the factory (plan, spec, build, review, run) with every agent, eval, quality gate and decision gate. Click a step for what it does, when it passes, what happens otherwise and its retry limit; filter by kind; the numbers show open issues at that step now. The map is data in `app.js` (`FLOW`): update it when the factory changes.
- **Issue timeline**: click an issue in Health or Cost for a Gantt chart of its steps. While it is open it updates itself every 5 seconds (30 without a token): it re-reads only that issue, its PRs, their comments and running factory runs, shows what is happening now (for example "Factory 3: build #87: Developer agent (2m)") and draws the running agent step as a growing bar. It also shows `Gate (Claude):` decisions as markers, the retries (extra spec or build runs, `@claude` fix rounds, job re-runs) and every activity and gate decision with its time and cost, newest first. The popup fits the window; only the activity list scrolls.
- **Cost**: per issue and step, today, this week and total. After each agent step the workflows run `.github/scripts/post-metrics.sh`, which reads the action's `execution_file` and comments `Factory metrics: … <!-- factory-metrics {json} -->` on the issue (or PR for the reviewer). The dashboard reads those comments, trusting only the owner, collaborators and `github-actions[bot]`.
- **Actions** (need a token, each behind a confirmation): squash-merge a PR (shows the evidence table, CI checks, commit statuses and the AI review first, needs an explicit tick, worded as an override when the review is not "looks good"), add `needs-spec` or `build-now`, re-run failed jobs, comment.

Where: GitHub Pages, deployed by `dashboard-pages.yml` on every push to `main` that touches the folder (one-time setup: Settings > Pages > Source: GitHub Actions). It also works locally: open `tools/factory-dashboard/index.html`, or serve the folder with any static server. `?repo=owner/name` points it at another repo.

Token: read-only views work without one (60 GitHub API calls per hour per IP, about 12 per refresh). For actions and higher limits, paste a **fine-grained personal access token for this repository only** with read/write on **Actions, Contents, Issues and Pull requests** (Metadata read is added automatically). It is stored in the browser's `localStorage`, sent only to `api.github.com`, never committed, and removed with "Forget token". Give it a short expiry. Labels and merges made with it are the owner's own actions, so the router still accepts them.

## Writing a good issue for the factory

- One user-visible outcome per issue, small enough for one night.
- Acceptance criteria as bullet points; the spec writer turns them into scenarios.
- Name the area (`area:web`, `area:extension`, `area:infra`).
- Put dependencies on their own line at the start of the body, `Depends on: #a, #b` (or `Depends on: none`); the scheduler reads it. Label `autopilot` to let the scheduler run the issue.

## Learn loop

When a gate or the human catches something an earlier step should have caught, add a row to [factory-learnings.md](factory-learnings.md) and turn it into a rule in the relevant `.claude/agents/*.md` file. The spec writer and reviewer read both.

## When to stop the review loop

The reviewer can always find something. A PR is ready for the human gate when it has **no high or medium findings**; low and info findings are optional and may be fixed later. At most two fix rounds per PR; after that the human decides.

## Schedules

GitHub's `schedule` event is best effort: runs can be delayed or dropped, most often at :00 and :30 (none fired at all in the factory's first day). So the crons sit off those minutes (scheduler :11/:41, watchdog :26/:56, nightly build 15:13 UTC, docs 02:47 UTC), and both the scheduler and the watchdog run `.github/scripts/revive-schedules.mjs`. It reads each workflow's cron line and starts any time-based workflow that missed its last slot by more than 30 minutes. The scheduler also runs on every issue and PR event, so any activity revives the watchdog, the nightly build and the docs job.

## Watchdog

`Factory 5: watchdog` runs every 30 minutes: restarts stalled agent runs (max 2 restarts, then `needs-human`) and unblocks factory/spec PRs that conflict with main. Its run summary lists every action.
