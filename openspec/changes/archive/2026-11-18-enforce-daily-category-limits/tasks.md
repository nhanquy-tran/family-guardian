# Tasks

## Shared and web
- [x] `RulesResponse.categoryOverrides` in `packages/shared/src/contracts.ts`
- [x] `handleRules` returns the merged `categoryOverrides` (family first when capped); tests in `packages/shared/src/contracts.test.ts` and `apps/web/src/lib/device/rules-endpoint.test.ts`

## Extension
- [x] `lib/limits.ts`: `dayKey`, `addUsage`, `overLimitCategories`, `limitBlockDomains`, `buildLimitRules`; tests in `apps/extension/lib/limits.test.ts`
- [x] `syncRules` stores limits, timezone, overrides and `limitBlocked`; `applyRules` optional limit rules; tests in `apps/extension/lib/rules.test.ts`
- [ ] Controller: count usage in `alarmNormal`, evaluate and apply, `recordBlocked` accepts limit-blocked domains, re-pair resets keys; tests in `apps/extension/lib/controller.test.ts` and `apps/extension/lib/pairing.test.ts` (implemented; 5 controller tests blocked by test concerns in NOTES.md)
- [x] Block page: `describeBlock`, `blocked/main.ts`, `blocked/index.html`; tests in `apps/extension/lib/blocked.test.ts`
