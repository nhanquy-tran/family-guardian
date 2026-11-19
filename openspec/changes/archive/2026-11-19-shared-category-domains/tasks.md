## 1. Shared
- [x] 1.1 Tests in `packages/shared/src/category-domains.test.ts`
- [x] 1.2 `packages/shared/src/category-domains.ts`; one export line in `index.ts`; `expandBlockRules` delegates

## 2. Web
- [x] 2.1 Tests in `apps/web/src/lib/device/rules-endpoint.test.ts`
- [x] 2.2 `rules-endpoint.ts` uses `categoryDomains` and the capped override map

## 3. Extension
- [x] 3.1 Tests in `apps/extension/lib/limits.test.ts`
- [x] 3.2 `limitBlockDomains` uses `categoryDomains`; drop its local expansion and cap code
