## ADDED Requirements

### Requirement: Dashboard banner for lost site access
The dashboard banner SHALL show, for each device whose `site_access` is false, `Blocking is off on <device>: site access was turned off`, where `<device>` is the device name when set, else `<child>'s <browser> on <os>`. `siteAccessLostLines(rows)` in `lib/alerts/banner.ts` SHALL build the lines ordered by child name then browser. The lines are independent of offline alerts, vanish once `site_access` is true, and a failed `loadSiteAccessLost` query SHALL return no rows without throwing.

#### Scenario: Lines for devices without access
File: `apps/web/src/lib/alerts/site-access-banner.test.ts`
- **GIVEN** rows for Mia's Firefox on Windows with no name, and Leo's Chrome on Windows named "School laptop", both false, and a third device with `site_access` true
- **WHEN** `siteAccessLostLines` runs on the false rows
- **THEN** it returns `Blocking is off on School laptop: site access was turned off` and `Blocking is off on Mia's Firefox on Windows: site access was turned off`, in child-name order Leo, Mia

#### Scenario: Loader reads only lost devices and survives errors
File: `apps/web/src/lib/alerts/site-access-banner.test.ts`
- **GIVEN** a fake Supabase client that records calls, then one that returns an error, then one that throws
- **WHEN** `loadSiteAccessLost` runs on each
- **THEN** the first filtered `devices` by `site_access = false` and returned its rows; the other two return `[]` without throwing

#### Scenario: Banner renders and disappears
File: `apps/web/src/components/offline-banner.test.ts`
- **GIVEN** the banner rendered with one device lacking site access and no offline alerts, then with none of either
- **WHEN** the markup is inspected
- **THEN** the first contains `Blocking is off on` inside an element with `role="alert"` and the second renders nothing
