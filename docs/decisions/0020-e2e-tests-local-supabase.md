# 0020. End-to-end tests on a local Supabase stack with generated, revertable data

Date: 2026-11-18. Status: accepted (owner approved 2026-11-18). Issue #123.

## Context
Unit and PGlite tests cover logic and SQL, but nothing exercised the dashboard in a browser against real data, and there were no realistic screens to look at (empty states, a week of usage, rules, alerts) on desktop and mobile.

## Decision
- **Backend**: the Supabase CLI local stack (Docker), configured by `supabase/config.toml` and the existing migrations. Never a hosted project: seeding and teardown refuse any host other than localhost (`e2e/local-supabase.ts`).
- **Data**: `e2e/fixtures/scenario.ts` generates a family in five cumulative stages (`empty`, `onboarded`, `week`, `rules-applied`, `alerts`) relative to the current time, with a seeded PRNG so the same stage gives the same week. It writes only what ADR 0005 allows (registrable domain, seconds, blocked domain, browser, OS, extension version).
- **Revertable**: every seeded row hangs off auth users at the reserved `@e2e.family-guardian.test` domain. Seeding tears down first; Playwright's global teardown tears down after the run (`E2E_KEEP=1` keeps the data). Deleting the family cascades to everything else. PGlite tests prove teardown returns the database to its prior state and leaves other families and global categories alone.
- **Sign-in**: Google is the only parent sign-in, so tests mint a session through the local admin API (magic link + verify) and set the `@supabase/ssr` cookies. No product code or sign-in method changes.
- **Tools**: `@playwright/test` (Chromium, desktop 1440x900 and Pixel 7), `tsx` to run the seed CLI (Node cannot load the shared package's extensionless TypeScript imports), and the `supabase` CLI via `npx`.

## Consequences
- Running e2e needs Docker Desktop locally and Docker on the CI runner (GitHub's Ubuntu runners have it).
- E2E runs nightly and on demand, not as a required PR check; it adds roughly 5 minutes (stack start, Next build, tests).
- Screenshots land in `e2e/screenshots/` (ignored by git) with an `index.html` contact sheet, and are uploaded as a CI artifact.
