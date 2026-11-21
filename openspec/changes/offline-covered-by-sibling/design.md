## Decisions
- Coverage is evaluated in SQL only, with no new column or table. "Covered" for detection means a sibling with `last_seen_at > d.last_seen_at` and `last_seen_at > p_now - 15 minutes`. The second condition keeps "every device silent" identical to today: when the sibling goes silent too, both devices are reported.
- Resolution uses the same rule: a sibling covers an open incident only if its `last_seen_at > a.incident_last_seen_at` and `last_seen_at > p_now - 15 minutes`. One rule in both functions keeps "every device silent" identical to today: when Firefox closed at 09:00 and the laptop shut at 12:00, the run at 12:15 finds and claims both devices, and `resolve_offline_alerts` resolves neither (Chrome is no longer reporting). `resolved_at` is `p_now`.
- If a sibling resolved an incident and later both go silent, the Firefox row (same `incident_last_seen_at`) is not re-created (existing unique rule); Chrome gets its own incident. Accepted.
- Banner: `activeOfflineAlerts` also requires `resolved_at` null, and `loadActiveOfflineAlerts` selects the column. The digest needs no code change: covered devices never get an incident, and resolved ones show as from-to as today.
- `create or replace` resets attributes, so the migration states them again. Both functions keep their exact current attributes: `find_offline_devices` stays `stable` and security invoker, `resolve_offline_alerts` stays `security definer`, both keep `set search_path = ''`, their signatures and service-role-only execute rights. A test checks the attributes and the access.

## Data model
None. No new tables or columns; `alerts.resolved_at` exists.

## Contracts
None. No shared type or device API change; installed extensions are unaffected.

## Failure modes
Both functions run in the database; a failure makes the existing endpoint return `500 server_error` and the next 5-minute run retries. A sibling with a null `last_seen_at` never covers (null comparison is not true), so an error cannot hide an incident. A failed banner query stays `[]`.

Tamper trade-off: a removed or disabled extension in one browser looks like a closed browser while another browser of the child reports, so it produces no incident. Offline alerts do not detect tampering per browser; force-install by policy (ADR 0002, 0024) is the control for that.

## Alternatives
Group devices into a laptop entity: more schema and pairing changes for the same effect. A longer threshold for every device: delays real alerts. Neither chosen.

## ADR impact
Follows ADR 0010 (pg_cron detection), 0016 (digest) and 0024 (one device per browser). No new or changed ADR.
