Docs to update:
- `docs/architecture.md`: say that `categoryDomains` in `packages/shared` is the single category-to-domain expansion for the rules endpoint and the extension.

## Summary
- `packages/shared/src/category-domains.ts`: `categoryDomains` implemented (validate, then sort, then cap; `truncated` flag). `expandBlockRules` delegates to it with no limit.
- `rules-endpoint.ts`: explicit domains first, then `categoryDomains` over the capped override map, with `exclude` = explicit and `limit` = remaining room.
- `apps/extension/lib/limits.ts`: `limitBlockDomains` calls `categoryDomains`; local expansion, cap and `DOMAIN_PATTERN` removed.
- Verified by `category-domains.test.ts`, `rules-endpoint.test.ts`, `limits.test.ts` and `block-rules.test.ts`. `npm run check` and `npm run build` pass (21 existing lint warnings, 0 errors).
