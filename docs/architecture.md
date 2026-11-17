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
| Policy installer | Generated `.reg` file | Force-install extension in Chrome, Edge, Brave; disable incognito |

## Data model (MVP)

```
families(id, name, created_at)
parents(user_id -> auth.users, family_id)
children(id, family_id, name, homework_categories[], rules_version, created_at)  -- rules_version bumped by triggers on block_rules and domain_categories
devices(id, child_id, name, token_hash, browser, os, extension_version, last_seen_at, created_at)
pairing_codes(code, child_id, expires_at)
usage_minutes(device_id, minute_utc, domain, seconds)        -- PK (device_id, minute_utc, domain)
block_rules(id, child_id, kind: 'domain'|'category', value)
domain_categories(domain, category)                          -- global seed + family overrides
block_events(device_id, at, domain)
alerts(id, device_id, kind, sent_at)
```

- Only the **registrable domain** (e.g. `youtube.com`) and seconds are stored. No URLs, titles, content, keystrokes or screenshots.
- Retention: 13 months for usage, then deleted by a cron job.

## Key flows

1. **Sign in**: parent signs in with Google (Supabase Auth). First sign-in creates a family.
2. **Pair**: parent adds a child and gets a 6-character code (valid 1 hour). The extension options page takes the code, calls `/api/device/pair`, and receives a device token (stored in `chrome.storage.local`; only a hash is stored server-side).
3. **Track**: the extension counts seconds for the focused tab's domain while the user is active (`chrome.idle`, 60 s threshold). Every minute it posts a heartbeat with per-domain seconds for the last minute(s). Failed posts stay in a local queue.
4. **Block**: the heartbeat response carries a rules version. On change, the extension fetches rules and updates `declarativeNetRequest` dynamic rules. Blocked navigations redirect to an extension page.
5. **Focus score**: per child per day. `focus = homework_seconds / total_seconds * 100 - switch_penalty`, where a switch is a change between a homework and a non-homework domain within an active session, and `switch_penalty = min(20, switches_per_hour * 2)`. Computed in `packages/shared` and shown on the dashboard.
6. **Tamper alert**: a `pg_cron` job every 5 minutes marks devices silent for over 15 minutes during the child's usual hours and calls the alert endpoint, which e-mails the parent via Resend once per incident.
7. **Install**: the dashboard generates a `.reg` file that sets `ExtensionInstallForcelist`, a private-mode policy (`IncognitoModeAvailability=1` for Chrome and Brave, `InPrivateModeAvailability=1` for Edge) and `BrowserGuestModeEnabled=0` (guest windows do not load extensions) for Chrome, Edge and Brave under `HKLM\SOFTWARE\Policies`. The child must use a Standard Windows account.

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
