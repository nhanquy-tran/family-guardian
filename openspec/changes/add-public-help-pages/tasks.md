## 1. Messages and components
- [ ] 1.1 Tests: `components/site/setup-guide.test.tsx`, `faq.test.tsx`, `help.test.tsx`
- [ ] 1.2 `messages/{en,vi,zh}.json` keys, `components/site/{setup-guide,faq,help}.tsx`

## 2. Routes and SEO
- [ ] 2.1 Tests: extend `app/site-routing.test.ts` (pages, metadata, sitemap), `components/site/home.test.tsx` (links), `site-purity.test.ts` (mobile rules)
- [ ] 2.2 `app/[locale]/{setup,faq,help}/page.tsx`, `app/sitemap.ts`, footer and home links, `apps/web/.env.example` line `NEXT_PUBLIC_SUPPORT_EMAIL=`

## 3. Finish
- [ ] 3.1 `npm run check` and `npm run build` pass
- [ ] 3.2 NOTES.md: docs to update (`docs/architecture.md` public site section, `apps/web/CLAUDE.md`, platform note: `NEXT_PUBLIC_*` needs a redeploy)
