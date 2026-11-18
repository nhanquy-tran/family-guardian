## 1. Locale helpers
- [ ] 1.1 Tests: `lib/i18n/locale.test.ts`, `lib/i18n/messages.test.ts`
- [ ] 1.2 `lib/i18n/locale.ts`, `lib/site.ts`, `messages/{en,vi,zh}.json`, `getMessages`

## 2. Pages and components
- [ ] 2.1 Tests: `components/site/home.test.tsx`, `components/site/language-switcher.test.tsx`, `components/site/site-purity.test.ts`
- [ ] 2.2 `components/site/*`, `app/[locale]/layout.tsx`, `app/[locale]/page.tsx`, root `app/page.tsx` redirect, Vietnamese font subset in `app/layout.tsx`

## 3. SEO and routing
- [ ] 3.1 Tests: `app/site-routing.test.ts`
- [ ] 3.2 `generateMetadata`, `app/sitemap.ts`, `app/robots.ts`; confirm `proxy.ts` unchanged

## 4. Finish
- [ ] 4.1 `npm run check` and `npm run build` pass
- [ ] 4.2 NOTES.md lists docs to update (`docs/architecture.md` public site section, `apps/web/CLAUDE.md` i18n note); follow-up: `<html lang="en">` is served on `/vi` and `/zh` (only an inner `lang` element is set)
