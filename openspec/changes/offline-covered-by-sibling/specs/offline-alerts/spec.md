## MODIFIED Requirements

### Requirement: Offline detection
`find_offline_devices(p_now)` SHALL return devices whose `last_seen_at` is at most `p_now - 15 minutes` and at least `p_now - 24 hours`, that have no `alerts` row with `kind = 'offline'` and `incident_last_seen_at = last_seen_at`, and that are not covered. A device is covered when another device of the same child has `last_seen_at` after this device's `last_seen_at` and after `p_now - 15 minutes`. Its execute right SHALL belong to `service_role` only.

#### Scenario: Silence thresholds
- **GIVEN** devices of separate children last seen 14 min 59 s, exactly 15 min, 23 h 59 min, exactly 24 h and 24 h 1 s before `p_now`, plus one never seen (`last_seen_at` null)
- **WHEN** `find_offline_devices(p_now)` runs
- **THEN** it returns the 15 min, 23 h 59 min and 24 h devices only

#### Scenario: One incident is recorded once
- **GIVEN** a device last seen 20 min ago with an alert whose `incident_last_seen_at` equals its `last_seen_at`
- **WHEN** `find_offline_devices(p_now)` runs
- **THEN** the device is not returned
- **AND** after the device's `last_seen_at` moves forward and then becomes 15 min old again, it is returned again

#### Scenario: Function and table access
- **GIVEN** the migration is applied
- **WHEN** roles `anon` and `authenticated` try to execute `find_offline_devices` and `call_offline_alerts`, or insert into `alerts`
- **THEN** each is denied, and `service_role` can execute `find_offline_devices`

#### Scenario: Duplicate claim rejected
- **GIVEN** an alert for `(device, incident_last_seen_at)` exists
- **WHEN** a second row with the same pair is inserted
- **THEN** the unique constraint rejects it

#### Scenario: Silent browser covered by an active browser
- **GIVEN** a child with a Chrome device last seen 2 min before `p_now` and a Firefox device last seen 3 h before `p_now`
- **WHEN** `find_offline_devices(p_now)` runs
- **THEN** it returns neither device

#### Scenario: Every browser silent
- **GIVEN** a child with a Chrome device last seen 20 min before `p_now` and a Firefox device last seen 3 h before `p_now`
- **WHEN** `find_offline_devices(p_now)` runs
- **THEN** it returns both devices

#### Scenario: Sibling reported before the silent device
- **GIVEN** a child with a Chrome device last seen 2 h before `p_now` and a Firefox device last seen 20 min before `p_now`
- **WHEN** `find_offline_devices(p_now)` runs
- **THEN** it returns both devices

#### Scenario: Single device child unchanged
- **GIVEN** a child with one device last seen 20 min before `p_now`, and another child's device seen 1 min before `p_now`
- **WHEN** `find_offline_devices(p_now)` runs
- **THEN** it returns the single device

#### Scenario: Another child's activity does not cover
- **GIVEN** a silent Firefox device of child A and an active Chrome device of child B in the same family
- **WHEN** `find_offline_devices(p_now)` runs
- **THEN** it returns the Firefox device

### Requirement: Dashboard banner
`activeOfflineAlerts(rows)` SHALL keep only alerts whose `resolved_at` is null and whose device's current `last_seen_at` equals the alert's `incident_last_seen_at`, newest `sent_at` first. The dashboard layout SHALL render a banner for each, naming child, browser, OS and last-seen time, and nothing when there are none. A failed alerts query SHALL NOT break the page.

#### Scenario: Active and resolved alerts
- **GIVEN** alert A (device last seen `11:40`, `incident_last_seen_at` `11:40`) and alert B (device last seen `11:55`, `incident_last_seen_at` `11:30`)
- **WHEN** `activeOfflineAlerts([A, B])` runs
- **THEN** it returns `[A]`

#### Scenario: Alert resolved by another browser
- **GIVEN** an alert whose device last seen equals `incident_last_seen_at` but whose `resolved_at` is set
- **WHEN** `activeOfflineAlerts` runs
- **THEN** it returns `[]`

#### Scenario: Ordering and empty
- **GIVEN** two active alerts with different `sent_at`, then an empty list
- **WHEN** `activeOfflineAlerts` runs on each
- **THEN** the first returns newest `sent_at` first and the second returns `[]`

#### Scenario: Banner query failure
- **GIVEN** the alerts query returns an error
- **WHEN** the banner data loader runs (`loadActiveOfflineAlerts` in `lib/alerts/banner.ts`, tested in `banner.test.ts`)
- **THEN** it returns `[]` and does not throw
