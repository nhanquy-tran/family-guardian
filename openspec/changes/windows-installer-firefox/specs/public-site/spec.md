## MODIFIED Requirements

### Requirement: Setup guide page

Each locale SHALL have `/<locale>/setup`, an ordered step-by-step guide for parents that matches the real flow: sign in, add a child, get a pairing code, run the `.reg` installer as administrator on the child's Windows laptop, use a Standard (not Administrator) Windows account, restart the browsers (Chrome, Edge, Brave and Firefox), pair the extension in each browser (a code for the same child) and check the dashboard. It SHALL link to `/install` for the files.

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
- **WHEN** `setup-guide.test.tsx` checks the words `Chrome`, `Edge`, `Brave`, `Firefox`, `Standard` and `Administrator`
- **THEN** every word that the install source contains is also in the guide markup of every locale

#### Scenario: Firefox in restart and pairing steps
- **GIVEN** `SetupGuide` rendered for each locale with `getMessages(locale)`
- **WHEN** `setup-guide.test.tsx` reads the `<li>` items for the restart and pairing steps
- **THEN** the restart item contains `Firefox` and the same `Chrome`, `Edge` and `Brave` words as before
- **AND** the pairing item equals the `setup.steps.pair` message, which contains `Firefox`, and `en.json`, `vi.json` and `zh.json` still have identical `setup.steps` keys
