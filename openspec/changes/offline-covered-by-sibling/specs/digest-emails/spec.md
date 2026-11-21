## MODIFIED Requirements

### Requirement: Offline endpoint records incidents without e-mail
`handleOfflineAlerts` SHALL keep its authentication and fail-closed secret check, find offline devices, claim each incident with `emailed_at` null (skip if the row exists), resolve returned incidents (`resolved_at` = now), and SHALL NOT send e-mail. `resolve_offline_alerts(p_now)` SHALL be executable by `service_role` only and SHALL also resolve an open incident when another device of the same child has `last_seen_at` after the incident's `incident_last_seen_at` and after `p_now - 15 minutes`.

#### Scenario: Incident recorded, nothing mailed
- **GIVEN** one offline device and a fake store and mailer
- **WHEN** the handler runs twice
- **THEN** the claim is made once with `emailed_at` null, the mailer is never called, and the responses are `200 { recorded: 1, skipped: 0 }` then `200 { recorded: 0, skipped: 0 }`

#### Scenario: Returned device resolves its incident
- **GIVEN** an alert with `incident_last_seen_at` `11:40`, null `resolved_at`, and its device `last_seen_at` `11:55`, and another alert whose device still has `last_seen_at` equal to its incident
- **WHEN** `resolve_offline_alerts(p_now)` runs twice
- **THEN** the first alert's `resolved_at` equals `p_now` after the first run and is unchanged after the second, and the other stays unresolved

#### Scenario: Active sibling resolves an open incident
- **GIVEN** `p_now` `12:00`, an open incident (`incident_last_seen_at` `11:40`) on a Firefox device that stays silent, and a Chrome device of the same child with `last_seen_at` `11:55`
- **WHEN** `resolve_offline_alerts(p_now)` runs twice
- **THEN** the incident's `resolved_at` equals `p_now` after the first run and is unchanged after the second

#### Scenario: Earlier sibling or other child does not resolve
- **GIVEN** an open incident (`incident_last_seen_at` `11:40`), a sibling device of the same child with `last_seen_at` `11:30`, and a device of another child with `last_seen_at` `11:55`
- **WHEN** `resolve_offline_alerts(p_now)` runs
- **THEN** the incident stays unresolved

#### Scenario: Silent sibling does not resolve
- **GIVEN** Chrome last seen 20 min before `p_now` and Firefox last seen 3 h before `p_now`, both with open incidents (`incident_last_seen_at` equal to their `last_seen_at`)
- **WHEN** `resolve_offline_alerts(p_now)` runs
- **THEN** neither incident is resolved

#### Scenario: Find, claim and resolve in one run
- **GIVEN** Firefox last seen 09:00 (covered by Chrome until then, so no incident), Chrome last seen 12:00, and `p_now` 12:15
- **WHEN** `find_offline_devices(p_now)` runs, both devices are claimed, and `resolve_offline_alerts(p_now)` runs
- **THEN** both devices are returned, both incidents are created, and both stay unresolved (tested in `supabase/tests/digest-emails.test.ts`)

#### Scenario: Function attributes kept
- **GIVEN** the migration is applied
- **WHEN** the catalog is read for both functions
- **THEN** `find_offline_devices` is `stable` and security invoker, `resolve_offline_alerts` is `security definer`, both have `search_path` set to empty, and only `service_role` can execute them

#### Scenario: Store failure and unconfigured secret
- **GIVEN** `findOfflineDevices` rejects, and separately an empty secret
- **WHEN** the handler runs
- **THEN** the first is `500 { error: "server_error" }`; the second is `500` and the store is never called
