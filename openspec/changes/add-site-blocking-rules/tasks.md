# Tasks

## 1. Tests first

- [ ] 1.1 Confirm #7 (schema + PGlite harness), #5 (categories), #9 (children page) and #10 (heartbeat, `rules_version`) are merged; if not, stop and report. #11 and #12 are not required.
- [ ] 1.2 Write `supabase/tests/site-blocking.test.ts` for the database scenarios in `specs/site-blocking/spec.md`
- [ ] 1.3 Write `packages/shared/src/block-rules.test.ts`; extend `packages/shared/src/contracts.test.ts`
- [ ] 1.4 Write `apps/web/src/lib/block-rules.test.ts` and `apps/web/src/lib/device/rules-endpoint.test.ts`; extend `apps/web/src/lib/device/heartbeat.test.ts`
- [ ] 1.5 Write `apps/web/src/components/block-rules-view.test.ts`; verify all new tests fail only because the code is missing

## 2. Database

- [ ] 2.1 Add `supabase/migrations/<timestamp>_site_blocking.sql` per design.md decision 1 (`block_rules` value checks and the `block_events` unique key only; do not touch the #10 objects); verify the database tests pass

## 3. Shared

- [ ] 3.1 Add `BlockedAttempt`, `MAX_BLOCKED_ATTEMPTS`, `MAX_RULE_DOMAINS`, `RulesResponse`, and optional `blocked` on `HeartbeatRequest` and `HeartbeatEnvelope` to `contracts.ts`
- [ ] 3.2 Add `packages/shared/src/block-rules.ts` with `expandBlockRules` and export it from `index.ts`; verify the shared tests pass

## 4. Web

- [ ] 4.1 `apps/web/src/lib/block-rules.ts`: `normalizeBlockDomain`, `listBlockRules`, `addDomainRule`, `addCategoryRule`, `removeBlockRule`
- [ ] 4.2 `BlockRulesView`, the rules page, its Server Actions, and a "Block sites" link per child on `/dashboard/children`
- [ ] 4.3 `src/lib/device/rules-endpoint.ts` (`handleRules`, `RulesStore`), the store implementation in `supabase-store.ts`, and `app/api/device/rules/route.ts` (GET only), reusing `hashDeviceToken` and `createAdminClient`
- [ ] 4.4 Heartbeat: add `insertBlocked` to `HeartbeatStore` and `supabase-store.ts`; validate and store `blocked` in `heartbeat.ts` between `upsertUsage` and `updateDevice`; verify with the extended `heartbeat.test.ts` (including a route-level check that a request without `blocked` still passes)

## 5. Verify

- [ ] 5.1 Update `docs/architecture.md`: rules endpoint, `blocked` on the heartbeat, `block_events` retention (13 months, same as usage), and the note that a new parent-editable `children` column needs a column grant
- [ ] 5.2 Run `npm run check` and `npm run build` and fix all failures without weakening tests
- [ ] 5.3 In the PR body say how the Server Actions (redirect, revalidate) were verified, and that DB-dependent behaviour is checked on production after merge (previews share the production database)
