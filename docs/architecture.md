# Architecture

Status: MVP (v0.1). Owner: product owner (human) + Claude (engineering).

## Goal

A parent can see what happens in the browser on their child's Windows laptop, block sites, and see a daily focus score. Up to 20 families. Installation must be simple.

## Context

```
Child's Windows laptop                         Cloud
┌──────────────────────────────┐   HTTPS    ┌──────────────────────────────────┐
│ Browser extension (MV3, WXT) │ ─1/min───▶ │ Next.js app on Vercel            │
│  Chrome / Edge / Brave       │            │  /api/device/pair                │
│  - active-tab domain + time  │            │  /api/device/heartbeat           │
│  - idle detection            │ ◀─rules─── │  /api/device/rules               │
│  - declarativeNetRequest     │            │  Parent dashboard (Google login) │
│    blocking                  │            ├──────────────────────────────────┤
│  - offline queue             │            │ Supabase                         │
│ .reg policy file:            │            │  Postgres + RLS per family       │
│  force-install, no incognito │            │  Auth (Google provider)          │
└──────────────────────────────┘            │  pg_cron: offline detection      │
                                            │ Resend: alert e-mail             │
Parent: any browser (phone/PC) ──────────▶  └──────────────────────────────────┘
```

## Components

| Component | Tech | Responsibility |
|---|---|---|
| `apps/extension` | TypeScript, [WXT](https://wxt.dev), Manifest V3 | Track active domain and seconds, detect idle, enforce block rules, send heartbeats, queue offline |
| `apps/web` | Next.js (App Router), TypeScript, Tailwind | Parent dashboard, device API, installer generation |
| `packages/shared` | TypeScript | API contracts (zod schemas), category list, focus-score function |
| `supabase/` | SQL migrations | Schema, RLS policies, cron jobs |
| Policy installer | Generated `.reg` file | Force-install extension in Chrome, Edge, Brave; disable private browsing (`InPrivateModeAvailability` in Edge) and guest mode (`BrowserGuestModeEnabled`) |

## Data model (MVP)

```
families(id, name, timezone, timezone_known, digest_frequency, digest_hour, created_at)  -- digest settings; parents may update them
parents(user_id -> auth.users, family_id)
children(id, family_id, name, homework_categories[], homework_domains[], rules_version, created_at)  -- rules_version bumped by triggers on block_rules and domain_categories
devices(id, child_id, name, token_hash, browser, os, extension_version, last_seen_at, created_at)
pairing_codes(code, child_id, expires_at)                    -- one active code per child; deleted on redeem
pair_attempts(id, ip_hash, at)                               -- rate limit: keyed HMAC of the IP, purged after 10 min (ADR 0012)
usage_minutes(device_id, minute_utc, domain, seconds)        -- PK (device_id, minute_utc, domain)
block_rules(id, child_id, kind: 'domain'|'category', value)
domain_categories(domain, category)                          -- global seed + family overrides
block_events(device_id, at, domain)
child_category_limits(child_id, category, minutes_per_day)   -- 5 to 1440; bumps the child's rules_version
alerts(id, device_id, kind, sent_at, incident_last_seen_at, emailed_at, resolved_at)  -- emailed_at unused since the digest
digest_runs(family_id, frequency, period_start, claimed_at)  -- one claim per digest, service role only; purged after 90 days
```

- Only the **registrable domain** (e.g. `youtube.com`) and seconds are stored. No URLs, titles, content, keystrokes or screenshots.
- Retention: 13 months for usage and for `block_events` (blocked domain plus time), then deleted by the `purge-old-data` pg_cron job (`purge_old_data`, daily 03:23 UTC).
- Block rules: a `domain` rule is a bare hostname kept as typed (blocking `docs.google.com` does not block `google.com`); a `category` rule is one of the 9 categories. Both are checked in the database.
- A new parent-editable `children` column needs a column grant too (parents have column-level update rights, see the heartbeat migration).

## Key flows

1. **Sign in**: parent signs in with Google (Supabase Auth). First sign-in creates a family.
2. **Pair**: parent adds a child and gets a 6-character code (valid 1 hour). The extension options page takes the code, calls `/api/device/pair`, and receives a device token (stored in `chrome.storage.local`; only a hash is stored server-side). Pairing again replaces the token and clears the local queue and tracker state. The API base URL comes from `WXT_API_BASE_URL` (https, or http on localhost). A new code deletes the child's earlier code. `redeem_pairing_code` deletes the code and inserts the device in one transaction, so a code works once. `/api/device/pair` allows 10 attempts per IP per 10 minutes (`register_pair_attempt`, service role only) and fails closed if the limiter fails.
3. **Track**: the extension counts seconds for the focused tab's domain while the user is active (`chrome.idle`, 60 s threshold). Every minute it posts a heartbeat with per-domain seconds for the last minute(s). Nothing is tracked before pairing. Completed minutes go into a local queue (`chrome.storage.local`, kept 7 days, sent oldest first in chunks of at most 1440, halved on `413`) and are removed only after a `200`; the server upserts idempotently. An alarm fires every minute and runs all work through one serialized chain. On `401` the device keeps its token and queue, stops tracking and retries with an empty heartbeat every 15 minutes; the options page then says to pair again.
4. **Block**: the heartbeat response carries a rules version. After a heartbeat whose version differs from the stored `rulesVersion`, the extension fetches the rules, stores them (`rulesVersion`, `rulesDomains`) and enforces them as dynamic `declarativeNetRequest` redirect rules; blocked navigations redirect to an extension page. Blocked attempts are queued in `blockedQueue` and sent in the first heartbeat request. The toolbar badge shows the minutes left of a category limit, computed locally from the stored limits and usage. `GET /api/device/rules` (device token) returns `{ rulesVersion, domains, truncated, limits, timezone }` (`limits`: daily minutes per category from `child_category_limits`; `timezone`: the family's): the child's domain rules plus category rules expanded through the seed and overrides, capped at 5000 domains (explicit domains first). The version is read before the rules. The heartbeat may carry `blocked: [{ at, domain }]` (max 1000), stored once per `(device_id, at, domain)` in `block_events`.
5. **Focus score**: per child per day. `focus = homework_seconds / total_seconds * 100 - switch_penalty`, where a switch is a change between a homework and a non-homework domain within an active session, and `switch_penalty = min(20, switches_per_hour * 2)`. Computed in `packages/shared` and shown on the dashboard. `/dashboard` is a focus overview; a child's homework domains and categories are edited on the homework settings page (`/dashboard/children/[childId]/homework`). Family category overrides are edited on `/dashboard/categories`.
6. **Offline alert and digest**: a `pg_cron` job every 5 minutes calls `POST /api/alerts/offline` through `pg_net` (secret from Vault). The endpoint detects silent devices (15 min to 24 h) and records an incident in `alerts`; it resolves incidents (`resolved_at`) when the device reports again. It sends no e-mail itself, and the dashboard banner shows every active incident. A second `pg_cron` job every 15 minutes calls `POST /api/digest/send`, which e-mails each family's parents a digest via Resend, at most once per period (claimed in `digest_runs`), following the family's `digest_frequency`, `digest_hour` and `timezone`.
7. **Usage view**: `/dashboard/usage/[childId]` shows per-day usage and a day timeline, computed by SQL aggregation functions (`usage_by_day`, `usage_timeline`). The timezone comes from the browser through the `?tz=` parameter (also read by `/dashboard`); it is not stored or logged.
8. **Install**: the dashboard generates a `.reg` file that sets `ExtensionInstallForcelist`, a private-mode policy (`IncognitoModeAvailability=1` for Chrome and Brave, `InPrivateModeAvailability=1` for Edge) and `BrowserGuestModeEnabled=0` (guest windows do not load extensions) for Chrome, Edge and Brave under `HKLM\SOFTWARE\Policies`. The child must use a Standard Windows account.

## Security

- Parent API: Supabase session cookie, RLS limits every row to the parent's family.
- Device API: bearer device token, hashed (SHA-256) server-side, scoped to one child. Rate-limited.
- Secrets live in Vercel/Supabase/GitHub secrets only, never in the repo.
- HTTPS only. Supabase service-role key used only in server routes.

## Non-functional targets (MVP)

- 20 families, about 60 devices, 1 heartbeat/min each, about 86k requests/day: well within free/hobby tiers.
- Dashboard p95 under 1 s for a 7-day view.
- Extension CPU/memory negligible; no content scripts except the block page.

## Out of scope for MVP

Time limits, allowed hours, extra time, content filtering, payments, Mac/Linux installers, mobile app, end-to-end encryption.
