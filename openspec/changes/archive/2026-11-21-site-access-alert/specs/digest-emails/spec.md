## MODIFIED Requirements

### Requirement: Digest content
For each child of the family the digest SHALL list offline incidents that started in the period (browser and OS, from, to or "still offline", family timezone), a `Site access off:` block for lost-site-access incidents of the period (none, no block), total active time, the top 3 domains, and the focus score (`computeFocusScore` with `homeworkDomainsFor`), then the dashboard link. Plain text, no URL but the dashboard link.

#### Scenario: Full child section
- **GIVEN** child "Mia" with an incident from `11:40` to `12:10` on Edge and Windows, usage of 5 domains, homework settings, timezone `UTC`
- **WHEN** `buildDigest` runs for a daily period
- **THEN** the text names `Mia`, `Edge`, `Windows`, `11:40` and `12:10`, shows total time, exactly the 3 domains with the most seconds in order, a focus score and `APP_URL/dashboard`

#### Scenario: Empty and partial cases
- **GIVEN** an incident with null `resolved_at`; a child with no incidents and no usage; a child without homework categories or domains
- **WHEN** `buildDigest` runs
- **THEN** the first shows "still offline", the second "No offline incidents" and "No activity" without a score, and the third says the focus score is not available and where to choose homework sites

#### Scenario: Weekly period
- **GIVEN** usage spread over 7 days
- **WHEN** `buildDigest` runs for a weekly period
- **THEN** totals, top sites and focus score cover all 7 days and the subject names the week's first and last day

#### Scenario: Usage read fails or is too large
- **GIVEN** two children, with usage reads failing for the first, and separately more than 30 pages for it
- **WHEN** `buildDigest` runs
- **THEN** the first section says "Usage unavailable" with none of its partial data, and the second is complete

#### Scenario: Only the family's data
- **GIVEN** two families with children and incidents
- **WHEN** the digest for family A is built
- **THEN** no name, device or domain of family B appears and every query is filtered by A's child ids

#### Scenario: Resolved and open incident
File: `apps/web/src/lib/digest/content.test.ts`
- **GIVEN** child "Mia" with a site-access incident from `13:00` to `13:30` on Firefox and Windows, and another started at `18:00` and not resolved, timezone `UTC`
- **WHEN** `buildDigest` runs for a daily period
- **THEN** Mia's section has `Site access off:` with lines `<Browser> on <OS>: from <start> to <end>` or `to still off`: `Firefox on Windows: from 13:00 to 13:30` and `Firefox on Windows: from 18:00 to still off`
- **AND** with two children and only one incident, `Site access off:` appears once, in that child's section, and `DigestSource.listSiteAccessIncidents(childIds, start, end)` was called with both child ids

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
