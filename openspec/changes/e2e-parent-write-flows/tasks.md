## 1. Tests first
- [ ] 1.1 Write `e2e/tests/flows/parent-writes.spec.ts` (the six flow scenarios) using `stageTest("onboarded")`; pairing calls send `x-forwarded-for: 192.0.2.<n>` from project name and run nonce, at most 3 per project
- [ ] 1.2 Add the teardown scenario to `e2e/fixtures/store.test.ts`

## 2. Setup
- [ ] 2.1 Set `PAIR_RATE_LIMIT_SECRET` (constant test value) in the web server env of `e2e/playwright.config.ts`

## 3. Docs
- [ ] 3.1 Describe the write flows in `e2e/README.md` (listed in NOTES.md)
