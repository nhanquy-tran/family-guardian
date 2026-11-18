## Routing
- Pages live under `apps/web/src/app/[locale]/` (`layout.tsx`, `page.tsx`). Static segments (`login`, `dashboard`, `install`, `privacy`, `api`, `auth`) win over `[locale]` in the Next router, so existing URLs are unaffected. `[locale]/page.tsx` sets `dynamicParams = false` and `generateStaticParams` returns the three locales, so `/fr` is a 404.
- `apps/web/src/app/page.tsx` becomes a server component that reads `Accept-Language` through `next/headers`, calls `pickLocale` and `redirect()`s to `/<locale>`. `proxy.ts` and its matcher (`/dashboard/:path*`, `/login`) are NOT changed: public pages never reach the proxy, so no Supabase call and no auth cookie is set on them.
- `<html lang>` stays in the root layout (`en`) to avoid moving every existing page into route groups. `[locale]/layout.tsx` wraps its content in an element with `lang={locale}`, which assistive technology honours. `hreflang` tags carry the language signal for search engines.

## i18n without a library
- `src/lib/i18n/locale.ts`: `LOCALES = ["en","vi","zh"]`, `DEFAULT_LOCALE = "en"`, `isLocale`, `pickLocale(header)`, `localePath(locale, rest)`.
- `pickLocale` parses `Accept-Language` entries with q-values (default 1), drops `q=0` and malformed entries, sorts by q (stable), and maps the primary subtag: `vi*` to `vi`, `zh*` (any script or region; the only Chinese we offer is Simplified) to `zh`, `en*` to `en`. `*` or no match gives `en`.
- `src/messages/<locale>.json`: nested objects of strings. `getMessages(locale)` returns the typed object (type derived from `en.json`). Components receive `messages` as a prop and never contain copy.
- Language names in the switcher are written in their own language: English, Tiếng Việt, 简体中文.

## Components (`apps/web/src/components/site/`)
`home.tsx` (hero, how it works, features, privacy section), `site-header.tsx`, `site-footer.tsx`, `language-switcher.tsx`. The switcher is a client component using `usePathname` (like `dashboard-nav.tsx`) that receives `locale` and falls back to `/<locale>` when `usePathname()` is null (tests mock `next/navigation`); it replaces the first path segment and keeps the rest, so it works for the help and FAQ pages added later. Links are plain `<a>`/`Link`: no cookie, no storage.

## Install link
The install-on-Windows step of "How it works" links to `/install` (kept English), so `home.tsx` contains `href="/install"`; the windows-installer home-link scenario points there.

## Design
Only `ui.ts` constants (`container`, `card`, `buttonPrimary`, `buttonSecondary`, `navLink`, `pill*`) and token utilities; `ui.ts` itself does not change. Illustrations are the `/icon.svg` image and CSS shapes (cards, pills, numbered circles). Text uses `text-ink` / `text-ink-2` only (the `web-ui` contrast rule). Inter is loaded by `next/font/google` (downloaded at build, served from our own domain, so no third-party request at runtime); `subsets` gains `"vietnamese"`. Chinese falls back to the system font stack. Layout is a single column with `flex-wrap`/`grid-cols-1` base and wider columns from `sm:`; no fixed widths.

## SEO
- `generateMetadata({ params })` in `[locale]/layout.tsx`: `title`, `description` from messages, `alternates.canonical` `<SITE_URL>/<locale>`, `alternates.languages` for `en`, `vi`, `zh` and `x-default` (the `/en` URL), `openGraph` (`title`, `description`, `url`, `siteName`, `type: "website"`, `locale`, `alternateLocale`).
- `SITE_URL = "https://family-guardian.co"` is a constant in `src/lib/site.ts` (no env var, so no redeploy trap and no secret).
- `app/sitemap.ts`: `/en`, `/vi`, `/zh`, `/privacy`. `app/robots.ts`: allow `/`, disallow `/dashboard`, `/api`, `/auth`, `/login`, `/install`, and point to the sitemap.

## Privacy and data
Nothing is stored, logged or collected, so no ADR is needed. No external calls are made, so the only failure path is a 404 for an unknown locale.

## Risks
- Footer help and FAQ links are 404 until the next issue (accepted, stated in the issue).
- Translations are written by the agent; native speakers can refine them later by editing the JSON files only.
