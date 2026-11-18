## ADDED Requirements

### Requirement: Locale in the URL

The site SHALL serve its public pages under `/en`, `/vi` and `/zh`. `/` SHALL redirect to the locale that best matches `Accept-Language` and to `en` when nothing matches. Any other first path segment under `[locale]` SHALL give 404. Existing app URLs SHALL keep their behaviour and `proxy.ts` SHALL NOT be changed.

#### Scenario: Supported locales and best match
- **GIVEN** `apps/web/src/lib/i18n/locale.ts`
- **WHEN** `apps/web/src/lib/i18n/locale.test.ts` calls `isLocale`, and `pickLocale` on the headers `vi-VN,vi;q=0.9,en;q=0.5`, `zh-CN,zh;q=0.9`, `zh-TW`, `en-GB,en;q=0.8,vi;q=0.9` and `fr,vi;q=0.4`
- **THEN** `LOCALES` equals `["en", "vi", "zh"]`, `DEFAULT_LOCALE` is `"en"`, `isLocale` is true for those three and false for `fr`, `login`, `dashboard`, `privacy` and the empty string, and `pickLocale` returns `vi`, `zh`, `zh`, `vi` and `vi`

#### Scenario: Fallback to English
- **GIVEN** the values `null`, `""`, `fr-FR,de;q=0.8`, `*`, `;;q=x` and `vi;q=0`
- **WHEN** `locale.test.ts` calls `pickLocale` on each
- **THEN** each returns `en` and none throws

#### Scenario: Root redirects by language
- **GIVEN** `next/headers` mocked to return `Accept-Language: vi`, then no header
- **WHEN** `apps/web/src/app/site-routing.test.ts` calls the default export of `apps/web/src/app/page.tsx`
- **THEN** it triggers a Next redirect to `/vi`, then to `/en`

#### Scenario: Unknown locale is 404
- **GIVEN** `apps/web/src/app/[locale]/page.tsx`
- **WHEN** `site-routing.test.ts` reads its exports
- **THEN** `dynamicParams` is `false` and `generateStaticParams()` returns exactly `en`, `vi` and `zh`

#### Scenario: Auth and app routes are untouched
- **GIVEN** `apps/web/src/proxy.ts` and the app directory
- **WHEN** `site-routing.test.ts` reads them
- **THEN** `config.matcher` equals `["/dashboard/:path*", "/login"]`, the proxy source contains neither `locale` nor `Accept-Language`, `authRedirect("/en", false)` and `authRedirect("/vi", true)` return `null`, and the files `login/page.tsx`, `dashboard/page.tsx`, `install/page.tsx`, `privacy/page.tsx` exist under `apps/web/src/app`

### Requirement: All copy comes from message files

All visible text of the public pages SHALL come from `apps/web/src/messages/en.json`, `vi.json` and `zh.json`. The three files SHALL have exactly the same keys, every value SHALL be a non-empty string, and no new dependency SHALL be added.

#### Scenario: Same keys in every language
- **GIVEN** the three message files
- **WHEN** `apps/web/src/lib/i18n/messages.test.ts` flattens their keys and compares `hero.title`, `hero.subtitle` and `privacy.title`
- **THEN** the key sets of `vi` and `zh` equal that of `en`, every value is a non-empty string, each of the three compared values in `vi` and in `zh` differs from the `en` value, and the `zh` values contain a CJK character

#### Scenario: Pages render the locale's messages
- **GIVEN** `Home` rendered for each locale with `getMessages(locale)`
- **WHEN** `apps/web/src/components/site/home.test.tsx` inspects the markup
- **THEN** it contains that locale's `hero.title`, and the `vi` and `zh` markup does not contain the `en` `hero.title`

#### Scenario: No pricing or trial content
- **GIVEN** every value of the three message files
- **WHEN** `messages.test.ts` searches case-insensitively for the ASCII whole words `price`, `pricing`, `plan`, `plans`, `trial`, `subscription`, `premium` and `paid`, and, as substrings (non-ASCII terms are never matched with `\b`), for `bảng giá`, `gói cước`, `dùng thử`, `定价`, `价格`, `套餐`, `试用`, `订阅` and `付费`
- **THEN** none is found, so normal words such as `đánh giá` are allowed

### Requirement: Home page content

Each locale's home page SHALL show a hero, a "How it works" section, a features section, a privacy section and a footer. The hero SHALL have a primary "Sign in as a parent" link to `/login` and a secondary "How it works" link to `#how-it-works`. The home page SHALL link to `/install` from the install-on-Windows step.

#### Scenario: Hero
- **GIVEN** `Home` rendered for `en`
- **WHEN** `home.test.tsx` inspects the markup
- **THEN** there is exactly one `<h1>` with the `hero.title` text, a link with `href="/login"` and the `buttonPrimary` classes with the text "Sign in as a parent", and a link with `href="#how-it-works"` and the `buttonSecondary` classes

#### Scenario: How it works and features
- **GIVEN** `Home` rendered for each locale
- **WHEN** `home.test.tsx` inspects the elements with `id="how-it-works"` and `id="features"`
- **THEN** `how-it-works` contains one `<ol>` with four `<li>` items whose texts are, in order, the `how.steps.*` messages for sign in with Google, add a child and pair the laptop, install on Windows, and see the dashboard, the third item contains a link with `href="/install"`, and `features` contains exactly five feature cards with the `features.*` titles for activity by domain and time, site and category blocking, daily focus score, offline alerts and digest, and privacy-first

#### Scenario: Privacy section
- **GIVEN** `Home` rendered for each locale
- **WHEN** `home.test.tsx` inspects the element with `id="privacy"`
- **THEN** it contains the `privacy.collected` messages (domain, time), the four `privacy.never.*` messages (URLs, content, keystrokes, screenshots) and a link with `href="/privacy"`

#### Scenario: Language, header and footer
- **GIVEN** the locale layout rendered for `zh` and for `vi` with `await Layout({ children, params: Promise.resolve({ locale }) })`
- **WHEN** `home.test.tsx` inspects the markup
- **THEN** the children are wrapped in an element with `lang` of that locale, the `<footer>` has links with `href` `/privacy`, `/zh/help` and `/zh/faq` (for `zh`), contains the language switcher, and the header has a link to `/login`

### Requirement: Language switcher on every page

Every public page SHALL show a language switcher that links to the same page in each of the three languages, written in each language's own name.

#### Scenario: Keeps the current page
- **GIVEN** `LanguageSwitcher` rendered with the prop `locale` `vi` and `next/navigation` mocked so `usePathname()` returns `/vi/help`
- **WHEN** `apps/web/src/components/site/language-switcher.test.tsx` inspects the markup and reads the source of the switcher and of `apps/web/src/app/[locale]/layout.tsx`
- **THEN** the links are, in order, "English" `/en/help`, "Tiếng Việt" `/vi/help` and "简体中文" `/zh/help`; each link has `lang` and `hreflang` of its locale; only the Tiếng Việt link has `aria-current="page"`; the switcher starts with `"use client"` and calls `usePathname`; and the layout renders `LanguageSwitcher`

#### Scenario: Home path
- **GIVEN** `LanguageSwitcher` rendered with `locale` `en` and `usePathname()` returning `/en`, then returning `null` (outside the router)
- **WHEN** `language-switcher.test.tsx` inspects the markup
- **THEN** in both cases the hrefs are `/en`, `/vi` and `/zh`

### Requirement: Public pages follow the design system

Public pages SHALL take colours from design tokens and styles from `ui.ts`, use Inter and the app icon, follow the system light or dark setting, work at 375 px without horizontal scroll, show a visible focus ring on every link and contrast text at least 4.5:1. Illustrations SHALL be the icon or CSS only.

#### Scenario: Tokens and ui.ts only
- **GIVEN** all `*.tsx` files under `apps/web/src/components/site` and `apps/web/src/app/[locale]`, `apps/web/package.json` and `apps/web/src/app/layout.tsx`
- **WHEN** `apps/web/src/components/site/site-purity.test.ts` scans them
- **THEN** no `.tsx` source matches `neutral-\d`, a Tailwind palette colour class, a hex colour, `dark:`, `text-muted`, `text-red`, `text-amber` or `text-green`, the home component imports from `ui`, `dependencies` and `devDependencies` contain no package whose name includes `i18n`, `intl`, `translate` or `locale`, and the root layout still imports `Inter` from `next/font/google` with `subsets` including `"latin"` and `"vietnamese"`

#### Scenario: Mobile friendly
- **GIVEN** the rendered home page and layout for each locale
- **WHEN** `site-purity.test.ts` inspects the class strings
- **THEN** none contains `w-[`, `min-w-[` or `whitespace-nowrap`, and the header and footer link rows contain `flex-wrap`

#### Scenario: Focus ring and local illustrations
- **GIVEN** the rendered layout and home page for each locale
- **WHEN** `home.test.tsx` lists every `<a` and `<img` element
- **THEN** each `<a` class attribute contains `focus-visible:`, every `<img` has `src="/icon.svg"` and the markup contains no `.png`, `.jpg`, `.jpeg`, `.webp` or `.gif`

### Requirement: SEO and sharing

Each locale page SHALL have its own `<title>`, description, canonical URL, `hreflang` alternates for all three locales plus `x-default`, and Open Graph tags. `/sitemap.xml` SHALL list the public pages only and `/robots.txt` SHALL keep private paths out and point to the sitemap.

#### Scenario: Metadata per locale
- **GIVEN** `generateMetadata` of `apps/web/src/app/[locale]/layout.tsx`
- **WHEN** `site-routing.test.ts` calls it for `en`, `vi` and `zh`
- **THEN** each `title` and `description` equals that locale's `meta.title` and `meta.description` message, the three titles are different, and for `vi` `alternates.canonical` is `https://family-guardian.co/vi`, `alternates.languages` maps `en`, `vi`, `zh` to `https://family-guardian.co/<locale>` and `x-default` to `https://family-guardian.co/en`, and `openGraph` has the same title and description, `url` `https://family-guardian.co/vi`, `type` `website`, `siteName` "Family Guardian" and `locale` `vi_VN`

#### Scenario: Sitemap and robots
- **GIVEN** the default exports of `apps/web/src/app/sitemap.ts` and `apps/web/src/app/robots.ts`
- **WHEN** `site-routing.test.ts` calls them
- **THEN** the sitemap URLs are exactly `https://family-guardian.co/en`, `/vi`, `/zh` and `/privacy` on that origin, none containing `dashboard`, `login`, `install`, `api` or `auth`; robots allows `/`, disallows `/dashboard`, `/api`, `/auth`, `/login` and `/install`, and its `sitemap` is `https://family-guardian.co/sitemap.xml`

### Requirement: No tracking on public pages

Public pages SHALL NOT include analytics, set cookies, use browser storage or request any third-party origin.

#### Scenario: No third-party requests or storage
- **GIVEN** the `.tsx` sources under `apps/web/src/components/site` and `apps/web/src/app/[locale]`, the root `apps/web/src/app/page.tsx`, the files in `apps/web/src/messages`, and the rendered home page for each locale
- **WHEN** `site-purity.test.ts` scans them
- **THEN** no `.tsx` source contains `document.cookie`, `localStorage`, `sessionStorage`, `gtag`, `googletagmanager` or `analytics`, no `.tsx` source or message file contains an `http(s)://` URL other than through the `SITE_URL` import, no source imports `cookies` from `next/headers` or calls `.cookies.set`, and the markup has no `<script src`, no `<iframe`, no `src="http` and no `href="http`
