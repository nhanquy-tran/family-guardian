## Context
ADR 0024 approves one yes/no heartbeat value for lost site access (amending ADR 0005). Parents can update only `devices.name` (column grant), so `site_access` is written by the service role only. Service worker facts (platform notes): state lives in `chrome.storage`, and the alarm runs every minute.

## Decisions
- **Check**: `permissions.contains({ origins: ["<all_urls>"] })`, injected into the controller as `permissions` (Chromium `chrome.permissions`, Firefox `browser.permissions`; WXT's `browser` covers both). Checked on every alarm, before the flush, and sent in the same request. If the call rejects, omit `siteAccess` (unknown is not "lost"; avoids false alarms), log without detail.
- **Wire**: `siteAccess: z.boolean().optional()` on `HeartbeatRequest` and `HeartbeatEnvelope`. A non-boolean value is an invalid envelope (`400`), like other envelope fields. Absent means "unknown": the server leaves `site_access` out of the update, so the stored value is kept (the column default `true` covers old extensions). A failed check therefore neither opens nor closes an incident.
- **Store**: `updateDevice` patch gains an optional `site_access`, written only when the heartbeat carries it, no extra call. The value in a keep-alive after `401` is ignored by the server: the token matched no device, so `handleHeartbeat` returns before `updateDevice`. The keep-alive scenario stays as a contract test only.
- **API-origin check**: the controller also calls `permissions.contains({ origins: [apiOrigin + "/*"] })` on each alarm and stores the boolean locally (`apiAccess`) for the options page. It is not sent (ADR 0024 allows one value). A rejection keeps the previous value.
- **Incidents by trigger**: an `after update of site_access` trigger on `devices` keeps `site_access_incidents` (`started_at`, `resolved_at`). One open incident per device (partial unique index). Time is the database `now()`, so no client clock is trusted. A repeated `false` changes nothing.
- **Banner**: reads `devices.site_access = false` directly (RLS, column grant), no cron. Resolves on the next heartbeat because the heartbeat writes `true`.
- **Digest**: new `DigestSource.listSiteAccessIncidents`; lines only when incidents exist. A failed listing fails the build, so the claim is released and the next run retries (same as `listIncidents`).
- Layout file untouched. `OfflineBanner` splits into a pure `OfflineBannerView({ offline, siteAccessLost })`, which tests render with `react-dom/server`, and a thin async `OfflineBanner` that creates the client, loads both lists (`loadActiveOfflineAlerts`, `loadSiteAccessLost`) and renders the view.

## Data model
- `devices.site_access boolean not null default true`. Owner: service role writes; parents read via `grant select (site_access)`. Existing rows become `true`. No retention beyond the device row.
- `site_access_incidents(id uuid pk default gen_random_uuid(), device_id uuid not null references devices on delete cascade, started_at timestamptz not null default now(), resolved_at timestamptz)`. RLS enabled; `select` policy limited to the parent's family (same shape as `alerts_select`); no insert/update/delete for `anon` or `authenticated`; service role full. Partial unique index on `(device_id) where resolved_at is null`. Retention 90 days (`purge_site_access_incidents()`, daily, guarded `pg_cron`). Existing rows: none.
- Trigger function `record_site_access_change()` is `security definer`, `set search_path = ''`, execute revoked from `public, anon, authenticated`.

## Contracts
- Shared: `HeartbeatRequest.siteAccess?` and `HeartbeatEnvelope.siteAccess?` (boolean). `HeartbeatResponse` unchanged.
- Installed extensions without the field keep working (optional). A new extension against an old server: zod on the old server is not strict-failing on unknown keys (default strip), so it is accepted and the value ignored; the deploy order is not critical.
- ADR 0005 allowed-fields list is amended by ADR 0024 for exactly this value.

## Failure modes
- **Residual risk: all host permissions withheld.** If the browser withholds every host permission, including our API origin, the heartbeat cannot reach the server and the device goes silent. No `siteAccess: false` arrives, so the parent sees no site-access line. They see the offline incident only when no other device of the child reports, because once #179 lands a silent device is not flagged while another one reports. This change cannot close that gap; the owner check in NOTES.md says whether it happens in real browsers, and the follow-up (out of scope) is CORS headers on the device routes for the extension origins, so heartbeats no longer need the API host permission.
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
