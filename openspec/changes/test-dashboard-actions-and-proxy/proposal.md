Depends on: none
Touches: dashboard-shell, parent-auth

# Test the dashboard server actions and the auth proxy

## Why
The test health report of 19 Nov 2026 shows the six `apps/web/src/app/dashboard/**/actions.ts` files and `apps/web/src/proxy.ts` mostly untested (pages and actions 27% lines, 11% branches; proxy 7%). Issue #154.

## What changes
- Unit tests for every exported server action: what it passes to the lib function, where it redirects on success and on each error, and what it revalidates.
- Unit tests for `proxy()`: redirect rules, cookie carry-over, matcher.
- One database test file asserting that a parent of another family cannot change any table the actions write.
- Target: at least 60% branch coverage for pages and actions, as measured by the next health report (no coverage tool or threshold is added to the repo).

## Out of scope
- No product code change. If a test reveals a bug, it is filed as its own issue.
- No new test library, coverage tooling or CI threshold.
- Page (`page.tsx`) tests beyond what exists.
