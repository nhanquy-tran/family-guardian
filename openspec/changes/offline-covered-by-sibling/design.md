## Decisions
- Coverage is evaluated in SQL only, with no new column or table. "Covered" for detection means a sibling with `last_seen_at > d.last_seen_at` and `last_seen_at > p_now - 15 minutes`. The second condition keeps "every device silent" identical to today: when the sibling goes silent too, both devices are reported.
- Resolution uses only "a sibling reported after `incident_last_seen_at`" (as if the silent device had reported). `resolved_at` is `p_now`.
- If a sibling resolved an incident and later both go silent, the Firefox row (same `incident_last_seen_at`) is not re-created (existing unique rule); Chrome gets its own incident. Accepted.
- Banner: `activeOfflineAlerts` also requires `resolved_at` null, and `loadActiveOfflineAlerts` selects the column. The digest needs no code change: covered devices never get an incident, and resolved ones show as from-to as today.
- Both functions keep their signatures, `search_path = ''` and service-role-only execute rights; the tests check access again.

## Data model
None. No new tables or columns; `alerts.resolved_at` exists.

## Contracts
None. No shared type or device API change; installed extensions are unaffected.

## Failure modes
Both functions run in the database; a failure makes the existing endpoint return `500 server_error` and the next 5-minute run retries. A sibling with a null `last_seen_at` never covers (null comparison is not true), so an error cannot hide an incident. A failed banner query stays `[]`.

## Alternatives
Group devices into a laptop entity: more schema and pairing changes for the same effect. A longer threshold for every device: delays real alerts. Neither chosen.

## ADR impact
Follows ADR 0010 (pg_cron detection), 0016 (digest) and 0024 (one device per browser). No new or changed ADR.
