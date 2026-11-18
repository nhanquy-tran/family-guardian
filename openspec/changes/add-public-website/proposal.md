Depends on: none
Touches: public-site, parent-auth, apps/web/src/app/layout.tsx

# Public website: home page in English, Vietnamese and Chinese (#98)

## Why
Parents who hear about Family Guardian have nowhere to learn what it is before signing in. `/` is a bare card. The app is free and not commercial, so the site only explains the product, its privacy promise and how to start. The site lives on the app's own domain (family-guardian.co, #97).

## What changes
- Locale in the URL: `/en`, `/vi`, `/zh`. `/` redirects to the best match of `Accept-Language` (default `en`). Unknown locales give 404.
- Home page per locale: hero, "How it works" (4 steps), features (5), privacy section (ADR 0005, links to `/privacy`), footer with privacy, help and FAQ links and a language switcher. No pricing, plans or trial text.
- All copy in `apps/web/src/messages/{en,vi,zh}.json`, read by a small `getMessages(locale)` helper (no i18n library). A test checks the three files have the same keys.
- Design: tokens and `ui.ts` classes only, Inter (Vietnamese subset added), the icon, CSS-only illustrations, light/dark from the system, 375 px, visible focus.
- SEO: per-locale title and description, `hreflang` alternates, canonical, Open Graph tags, `sitemap.xml`, `robots.txt`.
- No tracking: no analytics, cookies or third-party requests on public pages.

## Out of scope
- Help and FAQ pages (next issue). The footer links to `/<locale>/help` and `/<locale>/faq`; they are 404 until that issue merges, and they are not in the sitemap yet.
- Translating `/privacy`, `/login`, `/install` and the dashboard (they stay English, same URLs).
- An Open Graph image, a locale cookie, a translation service or any new dependency.
- Any change to `proxy.ts`, auth, the device API, the database or what the extension collects.
