# Questions for issue #157: Generate e2e fixtures once per test file

No spec was written. This issue changes no product behaviour, so there is nothing to put in a delta spec.

## Why a spec does not fit

- No capability in `openspec/specs/` covers the e2e fixture generator (`e2e/fixtures/scenario.ts`). Only ADR 0021 mentions it. A MODIFIED requirement has nothing to modify.
- The only new "behaviour" is that `generate.test.ts` calls `generate()` less often. A scenario for that would test the test file itself, and the coverage gate (scenario title = test title) cannot check it.
- A new `e2e-fixtures` capability would make the change "risky" under ADR 0022. That is a lot of process for a test refactor.

## What the issue needs

`e2e/fixtures/generate.test.ts` should call `generate(stage, NOW)` once per stage per file and share the result. These calls repeat work today:

- `is deterministic for the same clock` calls `generate("alerts", NOW)` twice, and `uses stable ids across stages` generates `onboarded` and `alerts` again.
- `leaves days before the rules unchanged` regenerates `week`, which `usage rows` already built.
- `usage rows`, `rules-applied` and `alerts` each build their own stage. A cache keyed by stage would remove the repeats.

Two cautions:

- Keep the determinism test calling `generate` twice. Sharing one result would make it always pass.
- Tests must not mutate a shared fixture. Treat it as read-only.

## Options

1. **Recommended: treat it as a chore.** Do it as a direct PR with no OpenSpec change. Acceptance: `npx vitest run e2e/fixtures/generate.test.ts` is clearly faster, every test keeps its title and assertions, and `npm run check` passes.
2. Keep it in the factory with a new `e2e-fixtures` capability. It would have one requirement, "fixture tests generate each stage once per file", checked by counting `generate` calls. Not recommended: it adds code to production files only for the test.

Please confirm option 1 (remove the `autopilot` label and handle it manually) or option 2.
