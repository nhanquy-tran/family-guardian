## MODIFIED Requirements

### Requirement: Dashboard banner
`activeOfflineAlerts(rows)` SHALL keep only alerts whose device's current `last_seen_at` equals the alert's `incident_last_seen_at`, newest `sent_at` first. The layout SHALL render a banner for each (child, browser, OS, last seen), else nothing. A failed alerts query SHALL NOT break the page. It SHALL also show a line per device whose `site_access` is false. A pure `OfflineBannerView({ offline, siteAccessLost })` renders it; the async `OfflineBanner` loads both lists.

#### Scenario: Active and resolved alerts
- **GIVEN** alert A (device last seen `11:40`, `incident_last_seen_at` `11:40`) and alert B (device last seen `11:55`, `incident_last_seen_at` `11:30`)
- **WHEN** `activeOfflineAlerts([A, B])` runs
- **THEN** it returns `[A]`

#### Scenario: Ordering and empty
- **GIVEN** two active alerts with different `sent_at`, then an empty list
- **WHEN** `activeOfflineAlerts` runs on each
- **THEN** the first returns newest `sent_at` first and the second returns `[]`

#### Scenario: Banner query failure
- **GIVEN** the alerts query returns an error
- **WHEN** the banner data loader runs (`loadActiveOfflineAlerts` in `lib/alerts/banner.ts`, tested in `banner.test.ts`)
- **THEN** it returns `[]` and does not throw

#### Scenario: Lines, order and loader
File: `apps/web/src/lib/alerts/site-access-banner.test.ts`
- **GIVEN** false rows for Mia's Firefox on Windows with no name, Leo's Chrome on Windows named "School laptop", Mia's Chrome named "Z laptop" and Mia's Chrome named "A laptop", plus a device with `site_access` true; then a fake client that records calls, one that returns an error, and one that throws
- **WHEN** `siteAccessLostLines` runs on the false rows, and `loadSiteAccessLost` on each client
- **THEN** each line reads `Blocking is off on <device>: site access was turned off` (`<device>`: name, else `<child>'s <browser> on <os>`) and the lines are, in order, `Blocking is off on School laptop: ...`, `Blocking is off on A laptop: ...`, `Blocking is off on Z laptop: ...` and `Blocking is off on Mia's Firefox on Windows: site access was turned off` (child name, then browser, then device name), and none for the true device; a failed `loadSiteAccessLost` returns `[]`
- **AND** the first client was filtered by `site_access = false` on `devices`, and the other two return `[]` without throwing

#### Scenario: Banner renders and disappears
File: `apps/web/src/components/offline-banner.test.ts`
- **GIVEN** `OfflineBannerView` rendered with `react-dom/server` with one `siteAccessLost` line and no offline alerts, then with both lists empty
- **WHEN** the markup is inspected
- **THEN** the first contains `Blocking is off on` inside an element with `role="alert"` and the second renders nothing
