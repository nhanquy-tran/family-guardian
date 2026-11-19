## Decisions
- Capability: no spec covers e2e today, so the flows are a new capability `e2e-parent-write-flows`. Product behaviour stays specified in `child-management`, `site-blocking`, `daily-limits` and `device-pairing`; these scenarios only prove the browser-to-device path, so there are no MODIFIED requirements.
- Stage: `onboarded` (Mia, Leo, Noah with no devices and no rules). Flows act on Noah, so the only device his rules reach is the one the test pairs. The stage is reseeded per project, so desktop and mobile never see each other's writes.
- Device token: the seed stores only token hashes, so the test gets a real token by pairing through the dashboard code and `POST /api/device/pair`, then calls `GET /api/device/rules` with `Authorization: Bearer <token>` (Playwright `request`). Device-dependent tests run in order in one `test.describe.serial`, the pairing test first, keeping the token in a describe-level variable.
- Pair rate limit is 10 per IP: keep at most 3 `/api/device/pair` calls per project. `playwright.config.ts` sets `PAIR_RATE_LIMIT_SECRET` to a constant test string in the web server env (not a secret; local stack only).
- Tests use accessible names already in the UI (`Child's name`, `Add child`, `Pair a device`, `Domain to block`, the `limit_games` input); no product markup changes. The blocked domain is `example-blocked.test`.
- Revertable (ADR 0021): every row hangs off the e2e family, so the global teardown already removes it; `pairing_codes`, `devices`, `block_rules` and `child_category_limits` cascade from the child. Rate-limit rows hold only a keyed IP hash and are purged by the existing daily job.
- Test titles equal the scenario titles.

## Data model
None. No tables, columns or migrations. Test data goes through the dashboard into existing tables and is removed by teardown.

## Contracts
None. No shared type or device API change. The tests call `/api/device/pair` and `/api/device/rules` as an installed extension would.

## Failure modes
- Local stack or web server down: Playwright fails the run; nothing is skipped silently.
- Teardown fails: every seed tears down first, so the next run starts clean. Seeding and teardown still refuse non-localhost hosts.
- Pair route returns 500 because the secret is missing: the pairing scenario fails loudly (the product fails closed, which is kept).

## Alternatives
- Insert a known token hash in the seed to skip pairing: simpler, but would not exercise the pairing flow the issue asks for.
- PGlite tests only: they already cover logic; the gap is the browser and the real HTTP path.

## ADR impact
Follows ADR 0021 (local stack, revertable data, reserved test domain) and ADR 0005 (the pairing request sends only browser and OS). No new or changed ADR.
