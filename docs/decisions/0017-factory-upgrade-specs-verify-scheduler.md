# 0017. Factory upgrade: source-of-truth specs, verify gate, scheduler, two-stage review, debugger, hidden tests

Date: 2026-11-17. Status: accepted (owner approved the audit plan, step 1 plus 2.3, 2.4, 2.5 and research items A1, A2, A3, A5, A6, A10).

## Context
The factory architecture audit (`docs/reports/factory-architecture-audit.html`) found that after 18 merged changes:
- `openspec/specs/` was empty, so every spec writer re-derived current behaviour from code and old changes, and two changes contradicted each other (offline alerts vs digest).
- Nothing checked a build against its spec beyond test titles; agents could pass by writing to the tests they could see.
- Scheduling was manual: Claude chose what to build next and avoided overlapping changes from memory.
- One reviewer mixed spec compliance and code quality; the arbiter decided test-vs-code without a debugging method.
- Agents had the owner PAT in their shell; no CodeQL or dependency updates; docs updates waited for Claude.
- `CLAUDE.md` grew into one long file every agent read in full.

## Decision
1. **Source-of-truth specs**: all merged changes are archived into `openspec/specs/` (22 capabilities). Spec writers read them and write MODIFIED/REMOVED deltas; the build archives the change when every gate passes.
2. **Verify gate**: a verifier agent runs the OpenSpec verify skill (completeness, correctness, coherence) and writes `VERIFY.md`; `VERIFY: CRITICAL` blocks archive and labels the PR `needs-human`.
3. **Hidden acceptance tests**: the test writer also writes 3 to 6 tests in `acceptance/<change>/`. The workflow removes them before the developer runs and restores them as a separate gate. Developer and debugger may not edit `acceptance/**`.
4. **Debugger replaces arbiter**: systematic debugging (reproduce, isolate, hypothesise, verify), decides code, test or spec, stops after 3 attempts, writes `## Debugging` in NOTES.
5. **Two-stage review**: stage 1 spec compliance; stage 2 code quality only if stage 1 has no high or medium findings.
6. **Scheduler** (`factory-scheduler.yml`, every 30 minutes and on merges): issues labelled `autopilot` are specified and built in `Depends on` order, two builds never share a `Touches` area, at most `FACTORY_MAX_PARALLEL` (3) agent jobs. It writes the `Factory state` issue, the progress file every new session reads first.
7. **Guardrails**: agents get no repository token in their shell; the developer may not edit tests, applied migrations, `docs/architecture.md` or `.env*`; a STOP rule asks it to write `## Test concerns` instead of fighting a test. Lint is auto-fixed by a deterministic step and by a PostToolUse hook locally. `@claude` runs with a tool allowlist.
8. **Hygiene**: CodeQL (security-extended) on PRs and weekly, Dependabot (npm weekly, actions monthly, grouped).
9. **Docs job** (`factory-docs.yml`, nightly): applies the `## Docs to update` notes of merged changes and opens one docs PR.
10. **Lean context**: root `CLAUDE.md` is an index; area rules live in `apps/web`, `apps/extension`, `supabase`, `packages/shared` `CLAUDE.md` files; procedures are skills (`add-migration`, `add-device-route`); ADRs have a one-line index.
11. **Branch protection** on `main`: PR plus the CI `check` job required.

Not adopted: a model gateway (overkill at this size, ADR 0007 stands), OpenHands and its sandbox, Graphify (see the audit: the repo is small and the bottleneck is specs and state, not code navigation).

## Consequences
- A build costs two more agent steps (verifier, and the debugger only on failure); the review costs one more step only when stage 1 passes. Expected about +15 % per change, offset by fewer gate rounds.
- Agents cannot pass by tuning to visible tests alone; a wrong hidden test still escalates to the gate.
- Archive on the PR branch means `openspec/specs/` changes in the same PR as the code; a PR that is not merged leaves specs untouched.
- The owner labels issues `autopilot` (with `Depends on:` in the body) instead of starting each spec and build by hand.

## Addendum (2026-11-18, after the #65 trial)
- When hidden tests fail, the debugger runs in hidden-test mode: it reads them and proposes code / test / spec per failure, and changes nothing but NOTES.md. The gate decides.
- `factory-evidence.yml` recomputes the PR evidence on every later push, so reviews judge the current state.
