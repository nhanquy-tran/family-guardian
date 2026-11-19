Depends on: none
Touches: e2e-parent-write-flows

# E2E: parent write flows

## Why
The e2e suite (ADR 0021) only reads seeded data. Nothing proves in a browser that what a parent changes in the dashboard reaches a paired device. Issue #155, from the 19 Nov 2026 test health report.

## What changes
- A new e2e spec file `e2e/tests/flows/parent-writes.spec.ts` on stage `onboarded`: add a child, generate a pairing code and pair with it, add a block rule and read it from `/api/device/rules` with the paired device's token, set a games limit and read it from the same endpoint.
- `e2e/playwright.config.ts` passes a fixed, non-secret `PAIR_RATE_LIMIT_SECRET` to the web server so `/api/device/pair` works in the stack.
- One PGlite test proving that rows written through these flows are removed by the existing teardown.
- A new capability spec `e2e-parent-write-flows` so the flows have named scenarios. No product code changes.

## Out of scope
- Rename and delete a child, allowed hours, category overrides, homework (later issues).
- Making e2e a required PR check (ADR 0021 keeps it nightly).
- Any change to seed stages, sign-in or screenshots.
