# Tasks

## Shared and web
- [ ] `RulesResponse.categoryOverrides` in `packages/shared/src/contracts.ts`
- [ ] `handleRules` returns the merged `categoryOverrides` (family first when capped); tests in `packages/shared/src/contracts.test.ts` and `apps/web/src/lib/device/rules-endpoint.test.ts`

## Extension
- [ ] `lib/limits.ts`: `dayKey`, `addUsage`, `overLimitCategories`, `limitBlockDomains`, `buildLimitRules`; tests in `apps/extension/lib/limits.test.ts`
- [ ] `syncRules` stores limits, timezone, overrides and `limitBlocked`; `applyRules` optional limit rules; tests in `apps/extension/lib/rules.test.ts`
- [ ] Controller: count usage in `alarmNormal`, evaluate and apply, `recordBlocked` accepts limit-blocked domains, re-pair resets keys; tests in `apps/extension/lib/controller.test.ts` and `apps/extension/lib/pairing.test.ts`
- [ ] Block page: `describeBlock`, `blocked/main.ts`, `blocked/index.html`; tests in `apps/extension/lib/blocked.test.ts`
