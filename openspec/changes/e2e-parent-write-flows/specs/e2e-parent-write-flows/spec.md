# e2e-parent-write-flows Specification

## Purpose
Prove in a real browser, against the local Supabase stack, that what a parent changes in the dashboard (child, pairing, block rule, daily limit) reaches a paired device, and that the data stays revertable (ADR 0021).

## ADDED Requirements

### Requirement: Parent write flows run end to end
The e2e suite SHALL include flows on stage `onboarded` in which a signed-in parent changes data only through the dashboard UI, and device-side effects SHALL be read through `/api/device/*` with a token obtained by pairing. Each test title MUST equal its scenario title. Test file: `e2e/tests/flows/parent-writes.spec.ts`.

#### Scenario: Parent adds a child
- **GIVEN** stage `onboarded` and a signed-in parent
- **WHEN** the parent opens `/dashboard/children`, fills "Child's name" with `Zoe` and presses "Add child" (`parent-writes.spec.ts`)
- **THEN** the page lists a child named `Zoe` next to Mia, Leo and Noah

#### Scenario: Parent generates a pairing code
- **GIVEN** Noah has no devices and no active code
- **WHEN** the parent presses "Pair a device" in Noah's card (`parent-writes.spec.ts`)
- **THEN** Noah's card shows a pairing code of 6 characters and its expiry

#### Scenario: Pairing with the generated code creates a device
- **GIVEN** the code shown for Noah
- **WHEN** `POST /api/device/pair` is called with `{ code, browser: "chrome", os: "Windows" }` (`parent-writes.spec.ts`)
- **THEN** the response is 200 with a `deviceToken` of 43 base64url characters
- **AND** `GET /api/device/rules` with that bearer token returns 200 and an empty `domains` list

#### Scenario: A used pairing code cannot pair again
- **GIVEN** the code from the previous scenario has been used
- **WHEN** `POST /api/device/pair` is called again with the same code (`parent-writes.spec.ts`)
- **THEN** the response is 400 `{ error: "invalid_code" }`

#### Scenario: Parent blocks a domain and the paired device receives it
- **GIVEN** Noah's paired device token and the `rulesVersion` it currently sees
- **WHEN** the parent opens Noah's rules page, fills "Domain to block" with `example-blocked.test` and submits (`parent-writes.spec.ts`)
- **THEN** the rules page lists a `domain` rule `example-blocked.test`
- **AND** `GET /api/device/rules` with the token returns `domains` containing `example-blocked.test` and a `rulesVersion` greater than before

#### Scenario: Parent sets a games limit and the paired device receives it
- **GIVEN** Noah's paired device token and no limits
- **WHEN** the parent enters `60` in the games limit on Noah's rules page and saves (`parent-writes.spec.ts`)
- **THEN** the games limit input shows `60` after a reload
- **AND** `GET /api/device/rules` returns `limits` containing `{ category: "games", minutesPerDay: 60 }`

### Requirement: Write flows leave nothing behind
Data written by the flows SHALL hang off the e2e family and MUST be removed by the existing `teardown`, leaving other families and global categories untouched. Test file: `e2e/fixtures/store.test.ts`.

#### Scenario: Rows written through the dashboard are removed by teardown
- **GIVEN** a seeded `onboarded` stage in PGlite, plus a second child, a block rule, a games limit, a pairing code and a paired device for an e2e child, and a separate family outside the e2e domain (`store.test.ts`)
- **WHEN** `teardown` runs
- **THEN** every count of `children`, `devices`, `block_rules`, `child_category_limits` and `pairing_codes` equals its value before the seed
- **AND** the separate family keeps all its rows
