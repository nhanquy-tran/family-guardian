# The AI factory

How Family Guardian is built: people set the target and decide at the gates, agents do the work, often overnight. Modelled on the Zühlke AI Factory production model (eight elements, five rules, six maturity steps) using only open-source parts. Decision: [ADR 0006](decisions/0006-ai-factory.md), auth and cost: [ADR 0007](decisions/0007-factory-auth-and-cost.md).

## Flow of one change (maturity step 03, human on the loop)

```
Owner writes issue ──label needs-spec──▶ Factory 0 router ──▶ Factory 1: spec-writer agent
                                                               │ opens PR "spec: …" (label spec)
                    GATE 1 (human): review + merge spec PR ◀────┘
                                │
                    Factory 2 labels issue `ready`
                                │
   22:00 nightly (or label build-now) ──▶ Factory 3: build
        1. test-writer agent writes failing tests from the scenarios   (checker ≠ producer)
        2. developer agent implements until check + build pass
        3. gate: tests not weakened (deterministic diff check)
        4. gate: npm run check + npm run build
        5. PR with evidence table, label factory (+ needs-human if a gate failed)
                                │
   CI (typecheck, lint, tests, build, gitleaks) ──▶ Factory 4: reviewer agent comments
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
| Observability and metrics | Evidence table per PR (model, wall time, gates), Actions run summary, Anthropic Console usage |

The five rules: (1) no agent approves its own work: only the owner merges; (2) the checker is not the producer: tests by a separate agent before implementation, deterministic gates before AI review; (3) every gate leaves evidence in the PR; (4) everything is a versioned file; (5) gateway: not used, see ADR 0007.

## Configuration

Repo secrets: `CLAUDE_API_KEY` (required), `FACTORY_TOKEN` (recommended: fine-grained PAT on this repo with Contents, Issues, Pull requests read/write. Without it, PRs opened by the factory do not trigger CI and AI review; the build job still runs its own gates).

Repo variables (optional): `FACTORY_SPEC_MODEL` (default `claude-opus-5-5`), `FACTORY_BUILD_MODEL` and `FACTORY_REVIEW_MODEL` (default `claude-sonnet-5-5`), `FACTORY_MAX_PER_NIGHT` (default 3), `FACTORY_DEV_MAX_TURNS` (default 80).

Security on a public repo: only the owner's labels and `@claude` comments trigger agents; dispatch needs write access. Issue text is treated as data by the agents.

## Writing a good issue for the factory

- One user-visible outcome per issue, small enough for one night.
- Acceptance criteria as bullet points; the spec writer turns them into scenarios.
- Name the area (`area:web`, `area:extension`, `area:infra`) and any dependency (`Depends on #n`).
