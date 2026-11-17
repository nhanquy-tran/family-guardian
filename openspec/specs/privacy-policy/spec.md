# privacy-policy Specification

## Purpose
A public, accurate privacy policy for the Chrome Web Store listing, and confirmed deletion of a child with all its data.

Test files:
- `apps/web/src/app/privacy/page.test.tsx`: renders `PrivacyPage` to static markup.
- `apps/web/src/lib/auth/redirects.test.ts`: existing; extended for `/privacy`.
- `apps/web/src/components/children-list.test.ts` and `apps/web/src/lib/children.test.ts`: existing delete tests; extended where noted.
- `supabase/tests/data-retention.test.ts`: cascade and RLS scenarios.

## Requirements

### Requirement: Public privacy page
`/privacy` SHALL be reachable without signing in.

#### Scenario: No redirect for anonymous visitors
- **GIVEN** no signed-in user
- **WHEN** `authRedirect("/privacy", false)` is evaluated and the proxy matcher is inspected
- **THEN** there is no redirect and `/privacy` is not matched by the proxy

### Requirement: Page states what is collected
The page SHALL list: website domain, seconds of use per minute, blocked domain with time, browser name, operating system name, extension version.

#### Scenario: Collected items listed
- **WHEN** the page is rendered
- **THEN** the text contains each of the six items

### Requirement: Page states what is never collected
The page SHALL state it never collects full web addresses, page titles, page content, search terms, keystrokes or screenshots.

#### Scenario: Never-collected items listed
- **WHEN** the page is rendered
- **THEN** the "never collected" section contains each of those six items

### Requirement: Page states retention and deletion
The page SHALL state retention of 13 months (from `RETENTION_MONTHS`) and how to delete: parents delete a child (with its devices and history) or a device in the dashboard; whole-account deletion is by request through the contact link. It SHALL NOT claim self-service account deletion.

#### Scenario: Retention and deletion text
- **WHEN** the page is rendered
- **THEN** it contains "13 months", "delete a child" and a link to the contact page
- **AND** it does not contain "whole family account at any time"

### Requirement: Deleting a child needs confirmation naming the data
Delete SHALL first show a confirmation naming the child, its devices, usage history and block history; only the confirm form deletes. Deleting removes the child and, by cascade, all its data.

#### Scenario: Confirmation text
- **GIVEN** child "Mia"
- **WHEN** `ChildrenList` renders with `confirmDelete` set to Mia's id
- **THEN** the text names "Mia", "devices", "usage history" and "block history"
- **AND** the Delete link itself deletes nothing

#### Scenario: Cascade removes all child data
- **GIVEN** a child with a device, usage, block events, rules and a pairing code
- **WHEN** the child row is deleted as its parent
- **THEN** all of those rows are gone and other children's rows remain

#### Scenario: Other family cannot delete
- **GIVEN** a parent of another family
- **WHEN** they delete the child
- **THEN** zero rows are deleted

#### Scenario: Delete failure is reported
- **GIVEN** the database returns an error
- **WHEN** `deleteChild` runs
- **THEN** it returns `{ ok: false }` with the generic error and the page shows it
