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

Each locale SHALL have `/<locale>/faq` with at least 10 questions as `<details>`/`<summary>` disclosure widgets. It SHALL answer: what is collected and what never is, which browsers and OS, whether a child can turn it off (Standard account, policy, incognito and guest blocked), how blocking and categories work, what the focus score means, offline alerts and digests, how many children and devices, deleting data and the account, cost (free, not commercial) and who can see the data.

#### Scenario: Disclosure widgets
- **GIVEN** `Faq` rendered for each locale
- **WHEN** `apps/web/src/components/site/faq.test.tsx` inspects the markup
- **THEN** there are at least 10 `<details>` elements, each with one `<summary>` that has a `focus-visible:` class and one answer with a non-empty text, and there is no `<script`

#### Scenario: Required topics
- **GIVEN** `Faq` rendered for `en`
- **WHEN** `faq.test.tsx` looks for the markers `collect`, `browser`, `turn`, `block`, `focus score`, `offline`, `children`, `delete`, `free` and `who can see` in the `<summary>` texts
- **THEN** each marker appears in at least one summary, the answer about what is collected mentions `domain` and the words `URL`, `keystroke` and `screenshot`, and the answer about turning it off mentions `Standard`, `incognito` and `guest`

#### Scenario: Same questions in every language
- **GIVEN** the three message files
- **WHEN** `faq.test.tsx` counts the `faq` question keys per locale
- **THEN** `vi` and `zh` have the same number of questions as `en`, and the first question and answer of `vi` and `zh` differ from `en`

### Requirement: Help page

Each locale SHALL have `/<locale>/help` with troubleshooting for: extension not showing, device offline, pairing code expired, blocked site still opens, and e-mails not arriving. It SHALL show a `mailto:` contact link built from `NEXT_PUBLIC_SUPPORT_EMAIL` and SHALL hide the contact section when the value is unset, empty or not an e-mail address.

#### Scenario: Troubleshooting cases
- **GIVEN** `Help` rendered for each locale without a support e-mail
- **WHEN** `apps/web/src/components/site/help.test.tsx` inspects the markup
- **THEN** there is one `<h1>` and five sections, in the order extension not showing, device offline, pairing code expired, blocked site still opens, e-mails not arriving, each with a heading, a non-empty text and at least one `<li>` step

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

The pages `/<locale>/setup`, `/<locale>/faq` and `/<locale>/help` SHALL exist only for the three locales, SHALL be linked from the footer and the home page, SHALL have their own title, description, canonical URL and `hreflang` alternates with `x-default`, and SHALL be listed in `sitemap.xml`. Their message values SHALL follow the same rules as the home page (same keys in every language, no pricing words).

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

#### Scenario: Sitemap lists the guide pages
- **GIVEN** the default export of `apps/web/src/app/sitemap.ts`
- **WHEN** `site-routing.test.ts` calls it
- **THEN** the URLs are exactly `https://family-guardian.co/<path>` for the 13 paths `en`, `vi`, `zh`, `en/setup`, `vi/setup`, `zh/setup`, `en/faq`, `vi/faq`, `zh/faq`, `en/help`, `vi/help`, `zh/help` and `privacy`, none containing `dashboard`, `login`, `install`, `api` or `auth`

#### Scenario: Footer and home links
- **GIVEN** `SiteFooter` and `Home` rendered for `vi`
- **WHEN** `apps/web/src/components/site/help.test.tsx` inspects the markup
- **THEN** the footer has links with `href` `/vi/setup`, `/vi/faq` and `/vi/help`, and the home page has a link with `href="/vi/setup"`

#### Scenario: Language switcher keeps the page
- **GIVEN** `LanguageSwitcher` with `locale` `zh` and `usePathname()` returning `/zh/faq`
- **WHEN** `apps/web/src/components/site/language-switcher.test.tsx` inspects the markup
- **THEN** the hrefs are `/en/faq`, `/vi/faq` and `/zh/faq`
