## MODIFIED Requirements

### Requirement: SEO and sharing

Each locale page SHALL have its own `<title>`, description, canonical URL, `hreflang` alternates for all three locales plus `x-default`, and Open Graph tags. `/sitemap.xml` SHALL list the public pages only and `/robots.txt` SHALL keep private paths out and point to the sitemap.

#### Scenario: Metadata per locale
- **GIVEN** `generateMetadata` of `apps/web/src/app/[locale]/layout.tsx`
- **WHEN** `site-routing.test.ts` calls it for `en`, `vi` and `zh`
- **THEN** each `title` and `description` equals that locale's `meta.title` and `meta.description` message, the three titles are different, and for `vi` `alternates.canonical` is `https://family-guardian.co/vi`, `alternates.languages` maps `en`, `vi`, `zh` to `https://family-guardian.co/<locale>` and `x-default` to `https://family-guardian.co/en`, and `openGraph` has the same title and description, `url` `https://family-guardian.co/vi`, `type` `website`, `siteName` "Family Guardian" and `locale` `vi_VN`

#### Scenario: Sitemap and robots
- **GIVEN** the default exports of `apps/web/src/app/sitemap.ts` and `apps/web/src/app/robots.ts`
- **WHEN** `site-routing.test.ts` calls them
- **THEN** the sitemap URLs are exactly `https://family-guardian.co/<path>` for the 13 paths `en`, `vi`, `zh`, `en/setup`, `vi/setup`, `zh/setup`, `en/faq`, `vi/faq`, `zh/faq`, `en/help`, `vi/help`, `zh/help` and `privacy`, none containing `dashboard`, `login`, `install`, `api` or `auth`; robots allows `/`, disallows `/dashboard`, `/api`, `/auth`, `/login` and `/install`, and its `sitemap` is `https://family-guardian.co/sitemap.xml`

## ADDED Requirements

### Requirement: Setup guide page

Each locale SHALL have `/<locale>/setup`, an ordered step-by-step guide for parents that matches the real flow: sign in, add a child, get a pairing code, run the `.reg` installer as administrator on the child's Windows laptop, use a Standard (not Administrator) Windows account, restart the browsers, pair the extension and check the dashboard. It SHALL link to `/install` for the files.

#### Scenario: Steps in order
- **GIVEN** `SetupGuide` rendered for each locale with `getMessages(locale)`
- **WHEN** `apps/web/src/components/site/setup-guide.test.tsx` inspects the markup
- **THEN** there is exactly one `<h1>` and one `<ol>` with eight `<li>` items whose texts are, in order, the `setup.steps.*` messages for sign in, add a child, get a pairing code, run the installer as administrator, Standard account, restart browsers, pair the extension and check the dashboard

#### Scenario: Links to the install page
- **GIVEN** `SetupGuide` rendered for each locale
- **WHEN** `setup-guide.test.tsx` inspects the markup
- **THEN** it contains a link with `href="/install"` and a link with `href="/login"`, and each `<a` class contains `focus-visible:`

#### Scenario: Same facts as the install page
- **GIVEN** the markup of `SetupGuide` for each locale and the source of `apps/web/src/components/install-instructions.tsx`
- **WHEN** `setup-guide.test.tsx` checks the words `Chrome`, `Edge`, `Brave`, `Standard` and `Administrator`
- **THEN** every word that the install source contains is also in the guide markup of every locale

### Requirement: FAQ page

Each locale SHALL have `/<locale>/faq` with at least 10 questions as `<details>`/`<summary>` disclosure widgets, covering what is collected, browsers and OS, turning it off, blocking, focus score, offline alerts, children and devices, deleting, cost, who can see the data and retention (13 months, `RETENTION_MONTHS`). Whole-account deletion SHALL be described as on request via the contact on `/privacy`; the FAQ SHALL NOT claim self-service account deletion.

#### Scenario: Disclosure widgets
- **GIVEN** `Faq` rendered for each locale
- **WHEN** `apps/web/src/components/site/faq.test.tsx` inspects the markup
- **THEN** there are at least 10 `<details>` elements, each with one `<summary>` that has a `focus-visible:` class and one answer with a non-empty text, and there is no `<script`

#### Scenario: Required topics
- **GIVEN** `Faq` rendered for `en`
- **WHEN** `faq.test.tsx` looks for the markers `collect`, `browser`, `turn off`, `block`, `focus score`, `offline`, `children`, `delete`, `free` and `who can see` in the `<summary>` texts
- **THEN** each marker appears in at least one summary, the answer about what is collected mentions `domain` and the words `URL`, `keystroke` and `screenshot`, and the answer about browsers mentions `Chrome`, `Edge`, `Brave` and `Windows`, the answer about turning it off mentions `Standard`, `incognito` and `guest`, the answer about deleting mentions deleting a child and `on request` and links to `/privacy` (`href="/privacy"`), and no FAQ text says `delete your account` or `at any time`; `vi` and `zh` use the locale's wording for these markers

#### Scenario: Same questions in every language
- **GIVEN** the three message files
- **WHEN** `faq.test.tsx` counts the `faq` question keys per locale
- **THEN** `vi` and `zh` have the same number of questions as `en`, and the first question and answer of `vi` and `zh` differ from `en`

### Requirement: Help page

Each locale SHALL have `/<locale>/help` with troubleshooting for: extension not showing, device offline, pairing code expired, blocked site still opens, and e-mails not arriving. Pairing code expired SHALL say a code is valid for 1 hour and a new code replaces the old one. It SHALL show a `mailto:` contact link built from `NEXT_PUBLIC_SUPPORT_EMAIL` and SHALL hide the contact section when the value is unset, empty or not an e-mail address.

#### Scenario: Troubleshooting cases
- **GIVEN** `Help` rendered for each locale without a support e-mail
- **WHEN** `apps/web/src/components/site/help.test.tsx` inspects the markup
- **THEN** there is one `<h1>` and five sections, in the order extension not showing, device offline, pairing code expired, blocked site still opens, e-mails not arriving, each with a heading, a non-empty text and at least one `<li>` step, and the pairing code section mentions 1 hour and a new code replacing the old one

#### Scenario: Contact link shown
- **GIVEN** `Help` rendered with `supportEmail` `owner@example.com`
- **WHEN** `help.test.tsx` inspects the markup
- **THEN** it contains one link with `href="mailto:owner@example.com"` and a `focus-visible:` class, inside an element with `id="contact"`

#### Scenario: Contact hidden without a valid address
- **GIVEN** `Help` rendered with `supportEmail` `undefined`, `""`, `"not an email"` and `"a@b.c d"`
- **WHEN** `help.test.tsx` inspects the markup
- **THEN** none contains `mailto:` or `id="contact"`

#### Scenario: Page reads the env variable
- **GIVEN** `apps/web/src/app/[locale]/help/page.tsx`
- **WHEN** `apps/web/src/app/site-routing.test.ts` reads its source and the sources under `apps/web/src/components/site`
- **THEN** the page source references `NEXT_PUBLIC_SUPPORT_EMAIL` and no component source does

### Requirement: Guide pages are routed, linked and indexed

The pages `/<locale>/setup`, `/<locale>/faq` and `/<locale>/help` SHALL exist only for the three locales, SHALL be linked from the footer and the home page, SHALL have their own title, description, canonical URL and `hreflang` alternates with `x-default`. Their message values SHALL follow the same rules as the home page (same keys in every language, no pricing words).

#### Scenario: Routes and 404
- **GIVEN** `apps/web/src/app/[locale]/setup/page.tsx`, `faq/page.tsx` and `help/page.tsx`
- **WHEN** `site-routing.test.ts` reads their exports
- **THEN** each has `dynamicParams` `false` and `generateStaticParams()` returns `en`, `vi` and `zh`, and none renders its own `<html>`

#### Scenario: Metadata and hreflang
- **GIVEN** `generateMetadata` of the faq page
- **WHEN** `site-routing.test.ts` calls it for `vi`
- **THEN** `title` and `description` equal the `faq.meta.title` and `faq.meta.description` messages of `vi`, `alternates.canonical` is `https://family-guardian.co/vi/faq`, `alternates.languages` maps `en`, `vi`, `zh` to `https://family-guardian.co/<locale>/faq` and `x-default` to `https://family-guardian.co/en/faq`

#### Scenario: Same metadata rules for setup and help
- **GIVEN** `generateMetadata` of the setup and help pages
- **WHEN** `site-routing.test.ts` calls each for `zh`
- **THEN** the canonicals are `https://family-guardian.co/zh/setup` and `https://family-guardian.co/zh/help`, and the three page titles for `zh` (setup, faq, help) are different from each other

#### Scenario: Footer and home links
- **GIVEN** `SiteFooter` and `Home` rendered for `vi`
- **WHEN** `apps/web/src/components/site/home.test.tsx` inspects the markup
- **THEN** the footer has links with `href` `/vi/setup`, `/vi/faq` and `/vi/help`, and the home page has a link with `href="/vi/setup"`

#### Scenario: Guide pages are mobile friendly
- **GIVEN** `SetupGuide`, `Faq` and `Help` rendered for each locale
- **WHEN** `apps/web/src/components/site/site-purity.test.ts` inspects the markup
- **THEN** none contains `w-[`, `min-w-[` or `whitespace-nowrap`, every `<img` has `src="/icon.svg"`, and every `<a` has a `focus-visible:` class
