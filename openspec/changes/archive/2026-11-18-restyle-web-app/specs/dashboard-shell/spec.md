## MODIFIED Requirements

### Requirement: Dashboard header
The dashboard shell SHALL show the app icon and wordmark "Family Guardian", the family name and a "Sign out" button in a form that posts to `/auth/sign-out`.

#### Scenario: Header shows family name and sign-out
- **WHEN** a test renders `DashboardShell` with `familyName` `"Tran family"` and child text `"page body"` (`dashboard-shell.test.ts`)
- **THEN** the markup contains `"Tran family"` and `"page body"`
- **AND** it contains a form with `method="post"` and `action="/auth/sign-out"` holding a button with text "Sign out"

#### Scenario: Header shows the brand
- **WHEN** a test renders `DashboardShell` (`dashboard-shell.test.ts`)
- **THEN** the header contains an `<img` with `src="/icon.svg"` and the text "Family Guardian"
