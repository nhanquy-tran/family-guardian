## Context
ADR 0024 approves one yes/no heartbeat value for lost site access (amending ADR 0005). Parents can update only `devices.name` (column grant), so `site_access` is written by the service role only. Service worker facts (platform notes): state lives in `chrome.storage`, and the alarm runs every minute.

## Decisions
- **Check**: `permissions.contains({ origins: ["<all_urls>"] })`, injected into the controller as `permissions` (Chromium `chrome.permissions`, Firefox `browser.permissions`; WXT's `browser` covers both). Checked on every alarm, before the flush, and sent in the same request. If the call rejects, omit `siteAccess` (unknown is not "lost"; avoids false alarms), log without detail.
- **Wire**: `siteAccess: z.boolean().optional()` on `HeartbeatRequest` and `HeartbeatEnvelope`. A non-boolean value is an invalid envelope (`400`), like other envelope fields. Absent means true, so an old extension that lost nothing never alarms, and the server writes `true` when absent (an old extension replacing a new one clears the flag).
- **Store**: `updateDevice` patch gains `site_access`. Written on every heartbeat, no extra call.
- **Incidents by trigger**: an `after update of site_access` trigger on `devices` keeps `site_access_incidents` (`started_at`, `resolved_at`). One open incident per device (partial unique index). Time is the database `now()`, so no client clock is trusted. A repeated `false` changes nothing.
- **Banner**: reads `devices.site_access = false` directly (RLS, column grant), no cron. Resolves on the next heartbeat because the heartbeat writes `true`.
- **Digest**: new `DigestSource.listSiteAccessIncidents`; lines only when incidents exist. A failed listing fails the build, so the claim is released and the next run retries (same as `listIncidents`).
- Layout file untouched: the existing `OfflineBanner` component renders both kinds.

## Data model
- `devices.site_access boolean not null default true`. Owner: service role writes; parents read via `grant select (site_access)`. Existing rows become `true`. No retention beyond the device row.
- `site_access_incidents(id uuid pk default gen_random_uuid(), device_id uuid not null references devices on delete cascade, started_at timestamptz not null default now(), resolved_at timestamptz)`. RLS enabled; `select` policy limited to the parent's family (same shape as `alerts_select`); no insert/update/delete for `anon` or `authenticated`; service role full. Partial unique index on `(device_id) where resolved_at is null`. Retention 90 days (`purge_site_access_incidents()`, daily, guarded `pg_cron`). Existing rows: none.
- Trigger function `record_site_access_change()` is `security definer`, `set search_path = ''`, execute revoked from `public, anon, authenticated`.

## Contracts
- Shared: `HeartbeatRequest.siteAccess?` and `HeartbeatEnvelope.siteAccess?` (boolean). `HeartbeatResponse` unchanged.
- Installed extensions without the field keep working (optional). A new extension against an old server: zod on the old server is not strict-failing on unknown keys (default strip), so it is accepted and the value ignored; the deploy order is not critical.
- ADR 0005 allowed-fields list is amended by ADR 0024 for exactly this value.

## Failure modes
- Permission check throws: field omitted; heartbeat still sent.
- Store write of `site_access` fails: the heartbeat fails with `500` as today; the extension retries next minute.
- Trigger failure rolls back the device update (`500`), retried next minute; fails visibly, not silently.
- Banner query fails: no site-access lines, page unaffected (like the offline banner).
- Digest incident query fails: digest not sent for that run, claim released, retried.
- Cron purge unavailable (PGlite): function exists, job guarded.

## Alternatives
- Only the column, no incident table: the digest could list currently-off devices but not resolved incidents, so it could not "list it like an offline incident". Rejected.
- Reuse `alerts` with a new kind: its unique key `(device_id, incident_last_seen_at)` would collide with an offline incident that starts at the same `last_seen_at`, silently dropping one, and changing the `kind` check edits an applied constraint. Rejected.
- Send an immediate e-mail: ADR 0016 replaced per-incident e-mail with digests.

## ADR impact
Follows ADR 0005 (as amended by 0024), 0016, 0024. Proposes ADR 0025 for the new stored incident data and its 90-day retention; adds its line to the ADR index.
