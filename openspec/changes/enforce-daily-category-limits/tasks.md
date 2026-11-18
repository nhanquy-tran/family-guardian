# Tasks

## Shared and web
- [ ] `RulesResponse.categoryOverrides` in `packages/shared/src/contracts.ts`
- [ ] Rules store method for family overrides (paged, throws) and `handleRules` output

## Extension
- [ ] `lib/limits.ts`: `dayKey`, `addUsage`, `overLimitCategories`, `limitBlockDomains`, `buildLimitRules`
- [ ] `syncRules` stores limits, timezone, overrides; `applyRules` optional limit rules
- [ ] Controller: count usage in `alarmNormal`, evaluate and apply, `recordBlocked` accepts limit-blocked domains, re-pair resets keys
- [ ] Block page: `describeBlock`, `blocked/main.ts`, `blocked/index.html`
