# 0006. AI factory: Claude Code Action, OpenSpec, GitHub Actions

Date: 2026-11-17. Status: accepted.

## Context
The product owner wants to experience an AI factory that works overnight, using open-source parts and following the Zühlke AI Factory model (eight elements, five rules, six steps).

## Decision
- Agents: Claude Code, run in GitHub Actions by `anthropics/claude-code-action`. Roles in `.claude/agents/`: spec-writer, developer, test-writer, reviewer.
- Specification: OpenSpec change proposals in `openspec/changes/`.
- Workflow: issue labels drive a state machine (see `docs/factory.md`).
- Gates: CI (typecheck, lint, unit, e2e) first, then AI review, then a human merge.
- Operating mode: Zühlke step 03, human on the loop. Human approves every spec and merges every PR.

## Alternatives rejected
- BMAD-METHOD: too heavy for two participants.
- GitHub Spec Kit: more ceremony than needed.
- Hosted factories (Orbi, SuperPlane): more setup and less transparent for learning.

## Consequences
Cheap to start, every element is a plain file. Quality depends on spec quality, so spec approval is the key human gate.
