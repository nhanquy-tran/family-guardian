## ADDED Requirements

### Requirement: Digest lists site-access incidents
For each child with a lost-site-access incident that started in the period, `buildDigest` SHALL add a `Site access off:` block with one line per incident (`<Browser> on <OS>: from <start> to <end>` or `to still off`, family timezone, as offline incidents) and no block otherwise. Incidents come from `DigestSource.listSiteAccessIncidents(childIds, start, end)`; if it rejects, `buildDigest` SHALL reject so the claim is released and retried.

#### Scenario: Resolved and open incident
File: `apps/web/src/lib/digest/content.test.ts`
- **GIVEN** child "Mia" with a site-access incident from `13:00` to `13:30` on Firefox and Windows, and another started at `18:00` and not resolved, timezone `UTC`
- **WHEN** `buildDigest` runs for a daily period
- **THEN** Mia's section has `Site access off:` with `Firefox on Windows: from 13:00 to 13:30` and `Firefox on Windows: from 18:00 to still off`

#### Scenario: No incident, no block
File: `apps/web/src/lib/digest/content.test.ts`
- **GIVEN** two children, only one with a site-access incident
- **WHEN** `buildDigest` runs
- **THEN** the text contains `Site access off:` once, inside the section of that child, and `listSiteAccessIncidents` was called with both child ids

#### Scenario: Listing fails
File: `apps/web/src/lib/digest/send.test.ts`
- **GIVEN** a due family and a source whose `listSiteAccessIncidents` rejects
- **WHEN** `handleDigestSend` runs
- **THEN** nothing is mailed, the claim is released and the response counts it as `failed` 1

#### Scenario: Store reads the family's incidents in the period
File: `apps/web/src/lib/digest/supabase-store.test.ts`
- **GIVEN** a fake client with incidents of three devices, one started before the period, one inside it, one after it
- **WHEN** `listSiteAccessIncidents(childIds, start, end)` runs, and then with a client that returns an error
- **THEN** it returns only the incident inside the period with the child id, browser, OS, `startedAt` and `resolvedAt`, and the second call throws
