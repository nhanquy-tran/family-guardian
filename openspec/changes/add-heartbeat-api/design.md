# Design

## Context

Architecture flows 3 and 4: the extension posts a heartbeat every minute with per-domain seconds for completed minutes (and resends queued ones after being offline), and reads `rulesVersion` from the response. Contracts `HeartbeatRequest` / `HeartbeatResponse` already exist in `packages/shared/src/contracts.ts`. The schema from change `add-database-schema` (#7) has `devices(token_hash unique)`, `usage_minutes` with PK `(device_id, minute_utc, domain)` and check constraints on `domain`, `seconds` and whole minutes, but no rules version and no extension version (explicitly left out there). Device writes go through the service role (RLS has no device policies). Requirements are in `specs/device-heartbeat/spec.md`.

## Goals / Non-Goals

**Goals:** authenticated, idempotent usage ingestion; one bad or stale entry never blocks a device's queue; rules version in the response; tested without a live Supabase.

**Non-Goals:** rate limiting, pair and rules routes, extension sending (see proposal, Out of scope).

## Decisions

1. **Pure handler plus thin route.** `apps/web/src/lib/device/heartbeat.ts` exports
   ```ts
   handleHeartbeat(input: { authorization: string | null; rawBody: string; now: Date; store: HeartbeatStore }):
     Promise<{ status: 200 | 400 | 401 | 500; body: HeartbeatResponse | { error: string } }>
   interface HeartbeatStore {
     findDevice(tokenHash: string): Promise<{ deviceId: string; rulesVersion: number } | null>;
     upsertUsage(rows: { device_id: string; minute_utc: string; domain: string; seconds: number }[]): Promise<void>;
     updateDevice(deviceId: string, patch: { last_seen_at: string; browser: string; extension_version: string }): Promise<void>;
   }
   ```
   The route reads `request.headers.get("authorization")` and `await request.text()`, calls the handler with `new Date()` and a Supabase-backed store, and returns `Response.json(body, { status })`. Only `POST` is exported, so Next.js answers other methods with `405`. Tests use a fake store; same pattern as `add-parent-google-sign-in` (logic in `.ts` modules taking a client).

2. **Order of checks.** Auth first, then body: an unauthenticated caller learns nothing about validation. Header must match `^Bearer (\S+)$` (case-sensitive scheme, single token). Hash with `node:crypto` SHA-256, lowercase hex (`hashDeviceToken` in `lib/device/token.ts`); the pair route must store the same format. Unknown hash → `401 { error: "unauthorized" }`. A revoked device is a deleted row, so it is also unknown. Then `JSON.parse` + `HeartbeatRequest.safeParse`; failure → `400 { error: "invalid_request" }` with no detail.

3. **Skip bad entries, do not fail the batch.** The extension keeps failed posts in a queue. If one stale or malformed entry made the whole request fail, the queue would be stuck forever. So the handler keeps an entry only if all hold, and silently skips the rest:
   - `minuteUtc` has zero seconds and milliseconds;
   - with `m0` = `now` truncated to the UTC minute: `m0 - 7 days <= minuteUtc <= m0` (exactly 7 days old is kept; the current minute may be partial and is still accepted);
   - `domain` matches `^[a-z0-9-]+(\.[a-z0-9-]+)+$` (the database check from #7; defence for ADR 0005 and avoids a `23514` failing the whole upsert).
   Alternative: `400` for the whole request; rejected for the queue reason above. The response does not report skipped entries; the extension drops a batch after `200` either way.

4. **Duplicates within one request.** Postgres rejects `on conflict do update` touching the same key twice in one statement. Entries are de-duplicated by `(minuteUtc, domain)`, the last occurrence wins, consistent with "resending replaces".

5. **Writes.** `upsertUsage` uses `supabase.from("usage_minutes").upsert(rows, { onConflict: "device_id,minute_utc,domain" })` (one statement, at most 1440 rows), skipped when there are no rows. `updateDevice` runs `update ... eq("id", deviceId)` with `last_seen_at = now.toISOString()`, `browser`, `extension_version`, even when `entries` is empty (keep-alive for offline detection, ADR 0010). Store errors → `500 { error: "server_error" }`. Usage is written before the device update; a failure in between is fixed by the extension's retry because the upsert is idempotent.

6. **Store implementation.** `lib/device/supabase-store.ts`: `createHeartbeatStore(client)`. `findDevice` selects `id, children(rules_version)` from `devices` where `token_hash = hash`, `maybeSingle()`. Client from `lib/supabase/admin.ts`: `createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })`; a missing env var throws naming it. Only route handlers import it; the key never gets a `NEXT_PUBLIC_` prefix.

7. **Migration** `supabase/migrations/<timestamp>_heartbeat.sql` (timestamp after the #7 migration):
   - `alter table devices add column extension_version text check (char_length(extension_version) <= 32)`; `grant select (extension_version) on devices to authenticated` so the dashboard can show it (the #7 column grant list is explicit).
   - `alter table children add column rules_version integer not null default 0`.
   - `public.bump_rules_version()` (`security definer`, `set search_path = ''`), `after insert or update or delete on block_rules for each row`: increments `rules_version` of `old.child_id` and `new.child_id` (both when a rule moves).
   - `public.bump_family_rules_version()` same style, `after insert or update or delete on domain_categories for each row`: when `coalesce(new.family_id, old.family_id)` is not null, increments `rules_version` of every child of that family (category rules depend on overrides). Global seed rows do not bump.
   Alternative: compute a version from `max(created_at)` of rules; rejected because deletes would not change it.

## Risks / Trade-offs

- [#7 not merged; this change adds to its schema] → Developer starts after #7 is merged; migration tests use the PGlite harness from #7.
- [Laptop clock ahead of server by over a minute] → Those minutes are skipped. Rare on Windows with time sync; listed out of scope.
- [Parents can write `children.rules_version` through their own update policy] → Only affects their own child, worst case one extra or one skipped rules fetch. Acceptable for MVP.
- [No rate limit yet] → A valid token is needed to write anything; rate limiting is a separate change.
- [Token hash format must match the pair route] → `hashDeviceToken` is the single helper; the pair route change must use it.
