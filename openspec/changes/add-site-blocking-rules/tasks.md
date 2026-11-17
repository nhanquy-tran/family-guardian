# Tasks

## 1. Tests first

- [ ] 1.1 Confirm #7 (schema + PGlite harness), #5 (categories), the auth shell, #9, #10 and #12 are merged; if not, stop and report
- [ ] 1.2 Write `supabase/tests/site-blocking.test.ts` for the database scenarios in `specs/site-blocking/spec.md`
- [ ] 1.3 Write `packages/shared/src/block-rules.test.ts` and `packages/shared/src/contracts.test.ts`
- [ ] 1.4 Write `apps/web/src/lib/block-rules.test.ts`, `apps/web/src/lib/device/rules-endpoint.test.ts`, `apps/web/src/lib/device/block-events.test.ts`, `apps/web/src/lib/blocked-today.test.ts`
- [ ] 1.5 Write `apps/web/src/components/block-rules-view.test.ts` and `apps/web/src/components/blocked-today-card.test.ts`; verify all new tests fail only because the code is missing

## 2. Database

- [ ] 2.1 Add `supabase/migrations/<timestamp>_site_blocking.sql` per design.md decision 1 (rules version column, bump trigger, children column grants, `block_rules` value checks, `block_events` unique key); verify the database tests pass

## 3. Shared

- [ ] 3.1 Add `BlockedAttempt`, `RulesResponse` and optional `HeartbeatRequest.blocked` to `contracts.ts`
- [ ] 3.2 Add `packages/shared/src/block-rules.ts` with `expandBlockRules` and export it from `index.ts`; verify the shared tests pass

## 4. Web

- [ ] 4.1 `apps/web/src/lib/block-rules.ts`: `normalizeBlockDomain`, `listBlockRules`, `addDomainRule`, `addCategoryRule`, `removeBlockRule`
- [ ] 4.2 `BlockRulesView`, the rules page, its Server Actions, and a "Block sites" link from the child overview
- [ ] 4.3 `src/lib/device/rules-endpoint.ts` and `app/api/device/rules/route.ts` (GET only), reusing or extracting the device auth helper from #10
- [ ] 4.4 `src/lib/device/block-events.ts` and the call from the heartbeat route
- [ ] 4.5 `src/lib/blocked-today.ts`, `BlockedTodayCard`, and the card on the child overview

## 5. Verify

- [ ] 5.1 Update `docs/architecture.md` (rules version on `children`, `blocked` on the heartbeat)
- [ ] 5.2 Run `npm run check` and `npm run build` and fix all failures without weakening tests
