# Design

## Context

Architecture flows 3 and 4: the extension posts a heartbeat every minute with per-domain seconds for completed minutes (and resends queued ones after being offline), and reads `rulesVersion` from the response. Contracts `HeartbeatRequest` / `HeartbeatResponse` already exist in `packages/shared/src/contracts.ts`. The schema from `supabase/migrations/20261117000000_initial_schema.sql` (change `add-database-schema`, PR #38) has `devices(token_hash unique)`, `usage_minutes` with PK `(device_id, minute_utc, domain)` and check constraints on `domain`, `seconds` and whole minutes, but no rules version and no extension version. Device writes go through the service role (RLS has no device policies). Requirements are in `specs/device-heartbeat/spec.md`.

## Goals / Non-Goals

**Goals:** authenticated, idempotent usage ingestion; one bad or stale entry never blocks a device's queue; rules version in the response; tested without a live Supabase.

**Non-Goals:** rate limiting, pair and rules routes, extension sending (see proposal, Out of scope).

## Decisions

1. **Pure handler plus thin route.** `apps/web/src/lib/device/heartbeat.ts` exports
   ```ts
   handleHeartbeat(input: { authorization: string | null; rawBody: string; now: Date; store: HeartbeatStore; log: (counts: { accepted: number; skipped: number }) => void }):
     Promise<{ status: 200 | 400 | 401 | 413 | 500; body: HeartbeatResponse | { error: string } }>
   interface HeartbeatStore {
     findDevice(tokenHash: string): Promise<{ deviceId: string; rulesVersion: number } | null>;
     upsertUsage(rows: { device_id: string; minute_utc: string; domain: string; seconds: number }[]): Promise<void>;
     updateDevice(deviceId: string, patch: { last_seen_at: string; browser: string; extension_version: string }): Promise<void>;
   }
   ```
   The route reads `request.headers.get("authorization")` and `await request.text()`, calls the handler with `new Date()`, a Supabase-backed store and `log` (one `console.info` line with the two counts), and returns `Response.json(body, { status })`. Only `POST` is exported, so Next.js answers other methods with `405`. Tests use a fake store; same pattern as `add-parent-google-sign-in` (logic in `.ts` modules taking a client).

2. **Order of checks.** Auth first, then body: an unauthenticated caller learns nothing about validation. Header must match `^bearer (\S+)$` case-insensitively (the scheme is case-insensitive per RFC 7235), with exactly one token: `Bearer a b` is `401`. A throwing `findDevice` fails closed with `500`, never an unhandled exception. Hash with `node:crypto` SHA-256, lowercase hex (`hashDeviceToken` in `lib/device/token.ts`); the pair route must store the same format. Unknown hash → `401 { error: "unauthorized" }`. A revoked device is a deleted row, so it is also unknown. Then `JSON.parse` + `HeartbeatEnvelope.safeParse` (`entries` is `z.array(z.unknown())` without a length cap; `browser`, `extensionVersion`, `currentDomain` as in `HeartbeatRequest`); failure → `400 { error: "invalid_request" }` with no detail. Only an unusable envelope is a `400`. Then, if `entries.length > MAX_HEARTBEAT_ENTRIES` (1440, exported from `@fg/shared` and also used by `HeartbeatRequest`), → `413 { error: "too_many_entries" }`. The cap is a `413`, not a `400`, so the client knows to split the batch; the extension MUST send at most `MAX_HEARTBEAT_ENTRIES` entries per request, oldest first, in chunks, so its queue is never stuck by size (change #11).

3. **Skip bad entries, do not fail the batch.** The extension keeps failed posts in a queue. If one stale or malformed entry made the whole request fail, the queue would be stuck forever (`HeartbeatRequest` as it is today would do exactly that, so the handler does not use it). Each entry is checked on its own with `UsageEntry.safeParse` (`seconds` 1 to 60 and ISO `minuteUtc` format stay defined there), and kept only if all hold; the rest are silently skipped:
   - it passes `UsageEntry`;
   - `minuteUtc` has zero seconds and milliseconds;
   - with `m0` = `now` truncated to the UTC minute: `m0 - 7 days <= minuteUtc <= m0 + 5 minutes` (exactly 7 days old and exactly 5 minutes ahead are kept; the current minute may be partial and is still accepted; the 5 minutes cover child laptop clock drift);
   - `domain` matches `^[a-z0-9-]+(\.[a-z0-9-]+)+$` (the database check from #7; defence for ADR 0005 and avoids a `23514` failing the whole upsert).
   Alternative: `400` for the whole request; rejected for the queue reason above. The handler logs one line per accepted request with only the counts `accepted` and `skipped` (no domains, tokens, ids or IPs), so silent loss such as clock skew is visible without new data. The response does not report skipped entries; the extension drops a batch after `200` either way.

4. **Duplicates within one request.** Postgres rejects `on conflict do update` touching the same key twice in one statement. Entries are de-duplicated by `(minuteUtc, domain)`, the last occurrence wins, consistent with "resending replaces".

5. **Writes.** `upsertUsage` uses `supabase.from("usage_minutes").upsert(rows, { onConflict: "device_id,minute_utc,domain" })` (one statement, at most `MAX_HEARTBEAT_ENTRIES` rows), skipped when there are no rows. `updateDevice` runs `update ... eq("id", deviceId)` with `last_seen_at = now.toISOString()`, `browser`, `extension_version`, even when `entries` is empty (keep-alive for offline detection, ADR 0010). Store errors, including `findDevice`, → `500 { error: "server_error" }`. Usage is written before the device update; a failure in between is fixed by the extension's retry because the upsert is idempotent.

6. **Store implementation.** `lib/device/supabase-store.ts`: `createHeartbeatStore(client)`. `findDevice` selects `id, children(rules_version)` from `devices` where `token_hash = hash`, `maybeSingle()`. Client from `lib/supabase/admin.ts`: `import "server-only"` first, then `createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })`; a missing env var throws naming it. Only route handlers import it; the key never gets a `NEXT_PUBLIC_` prefix.

7. **Migration** `supabase/migrations/<timestamp>_heartbeat.sql` (timestamp after `20261117000000`):
   - `alter table devices add column extension_version text check (char_length(extension_version) <= 32)`; `grant select (extension_version) on devices to authenticated` so the dashboard can show it (the initial schema's column grant list is explicit).
   - `alter table children add column rules_version integer not null default 0`.
   - `rules_version` is changed only by triggers: `revoke insert, update on children from authenticated`, then `grant insert (family_id, name, homework_categories), update (family_id, name, homework_categories) on children to authenticated` (a column-level `revoke` alone has no effect while a table-level grant exists). RLS policies are unchanged; renaming a child still works.
   - `public.bump_rules_version()` (`security definer`, `set search_path = ''`), `after insert or update or delete on block_rules for each row`: increments `rules_version` of `old.child_id` and `new.child_id` (both when a rule moves).
   - `public.bump_family_rules_version()` same style, `after insert or update or delete on domain_categories for each row`: when `coalesce(new.family_id, old.family_id)` is not null, increments `rules_version` of every child of that family (category rules depend on overrides). Global seed rows do not bump.
   - Both functions: `revoke execute on function public.bump_rules_version(), public.bump_family_rules_version() from public, anon, authenticated`, like `purge_expired_pairing_code` in the initial schema. Triggers still fire.
   - `bump_family_rules_version` bumps the old and the new family when an update changes `family_id`, like the block_rules trigger.
   Alternative: compute a version from `max(created_at)` of rules; rejected because deletes would not change it.

8. **Shared helpers with change #9 (PR #36).** Both changes need `apps/web/src/lib/supabase/admin.ts` and a token hash. `hashDeviceToken` in `apps/web/src/lib/device/token.ts` (SHA-256, lowercase hex) is the single hash helper, and `admin.ts` imports `server-only`. Whichever change is built first creates these files; the other reuses them unchanged and only adds missing tests. The pair route must store tokens with `hashDeviceToken`.

9. **Owner decisions.** The ADR 0005 amendment (2026-11-17) allowing `extensionVersion` (max 32 characters) is approved. Skipping invalid entries is accepted, with the counts logged (decision 3).

## Risks / Trade-offs

- [Depends on the initial schema from PR #38] → Build only after #38 is merged; the migration follows `supabase/migrations/20261117000000_initial_schema.sql` and its tests use its PGlite harness.
- [Laptop clock ahead of server by more than 5 minutes] → Those minutes are skipped silently. Rare on Windows with time sync.
- [Silent skipping loses data unnoticed] → Accepted by the owner; counts are logged per request; the extension drops the batch after `200` either way.
- [Extension sends more than 1440 entries after a long offline period] → `413 too_many_entries`; the extension must chunk (change #11), otherwise its queue would be stuck.
- [`SUPABASE_SERVICE_ROLE_KEY` in Vercel] → Server only, never `NEXT_PUBLIC_`; accepted for MVP.
- [No rate limit yet] → A valid token is needed to write anything; rate limiting is a separate change.
- [Token hash format must match the pair route] → `hashDeviceToken` is the single helper; the pair route change must use it.
