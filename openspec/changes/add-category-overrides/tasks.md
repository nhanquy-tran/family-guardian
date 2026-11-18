## 1. Tests first
- [ ] 1.1 `supabase/tests/category-overrides.test.ts`
- [ ] 1.2 `apps/web/src/lib/category-overrides.test.ts`
- [ ] 1.3 `apps/web/src/components/category-overrides-view.test.ts`
- [ ] 1.4 `packages/shared/src/usage-summary.test.ts` and `apps/web/src/lib/usage.test.ts` (overrides scenarios)
- [ ] 1.5 `apps/web/src/components/usage-change-category.test.ts` and the nav scenarios in `apps/web/src/components/dashboard-shell.test.ts`

## 2. Implementation
- [ ] 2.1 `lib/category-overrides.ts`
- [ ] 2.2 `components/category-overrides-view.tsx`
- [ ] 2.3 `app/dashboard/categories/page.tsx` and `actions.ts`
- [ ] 2.4 Nav item in `dashboard-nav.tsx`
- [ ] 2.5 "Change category" link (wrapping row) in the usage view
- [ ] 2.6 Optional overrides map in `usage-summary.ts`; `loadUsage` loads and passes it

## 3. Wrap-up
- [ ] 3.1 `npm run check` and `npm run build` pass
- [ ] 3.2 NOTES.md lists docs to update (`docs/architecture.md` if it lists pages)
