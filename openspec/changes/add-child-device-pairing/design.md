# Design

## Context

Issue #7 defines the schema: `children(id, family_id, name 1..50, homework_categories)`, `devices(id, child_id, token_hash unique, browser in chrome|edge|brave|other, os <= 32 chars, last_seen_at)`, `pairing_codes(code pk ^[A-Z0-9]{6}$, child_id, expires_at)`, parents may insert/update/delete children and pairing codes of their own family through RLS, only the service role writes `devices`, and a trigger purges an expired row with the same code so the primary key only rejects active duplicates (`23505`). Issue #8 adds `src/lib/supabase/server.ts` (anon key, session cookies) and the dashboard shell with a Children nav link. This change fills `/dashboard/children` and adds `/api/device/pair`. Requirements are in `specs/child-management/spec.md` and `specs/device-pairing/spec.md`.

As in #8, pages, server actions and route handlers stay thin; logic lives in `.ts` modules that take their dependencies (Supabase client, random source, clock) as parameters, so unit tests pass fakes.

## Goals / Non-Goals

**Goals:** a parent can manage children and get a pairing code; a browser can trade a valid code for a device token exactly once; brute force is limited.

**Non-Goals:** extension UI, device management, heartbeat auth (see proposal, Out of scope).

## Decisions

1. **Shared pairing helpers** (`packages/shared/src/pairing.ts`, exported from `index.ts`):
   - `PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"` (32 chars, no `0 O 1 I`), `PAIRING_CODE_LENGTH = 6`, `PAIRING_CODE_TTL_MS = 3_600_000`.
   - `generatePairingCode(randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n)))`: maps each byte with `byte % 32`; unbiased because 256 is a multiple of 32.
   - `normalizePairingCode(input)`: uppercase, remove spaces and `-`; returns the code if it matches `^[A-HJ-NP-Z2-9]{6}$`, else `null`.
   - `PairRequest = z.object({ code: z.string().max(32), browser: z.enum(["chrome","edge","brave","other"]), os: z.string().min(1).max(32) })`, `PairResponse = z.object({ deviceToken: z.string() })`. Only browser and OS name besides the code (ADR 0005).

2. **Children** (`apps/web/src/lib/children.ts`), all with the parent's server client:
   - `listChildren(client)`: `children.select("id, name, created_at").order("created_at")`.
   - `addChild(client, name)`: trims; rejects empty or > 50 chars with `{ ok: false, error: "Name must be 1 to 50 characters" }` before any DB call; reads `parents.select("family_id").maybeSingle()` and inserts `{ family_id, name }`.
   - `renameChild(client, id, name)`: same validation, `update({ name }).eq("id", id)`.
   - `deleteChild(client, id)`: `delete().eq("id", id)`. Devices, pairing codes and usage go with it via `on delete cascade` (#7).
   - RLS keeps every call inside the family; the code never passes a `family_id` it did not read from `parents`.
   - Page `app/dashboard/children/page.tsx` (Server Component) loads children and their newest active code (`pairing_codes.select("code, child_id, expires_at").gt("expires_at", now)`), renders `<ChildrenList items activeCodes error pairError actions />` (`src/components/children-list.tsx`; `items` instead of `children` to avoid the React prop; `activeCodes` maps child id to `{ code, expiresAt }`; `pairError` is `{ childId, reason }`; `actions` holds the server action functions so tests can pass stubs). Server actions in `app/dashboard/children/actions.ts` call the lib, then `revalidatePath("/dashboard/children")` or `redirect` with a `?error=` / `?pairError=<childId>` query. Delete uses a plain submit button (no JS confirm) for MVP.

3. **Code creation with retry** (`apps/web/src/lib/pairing/create-code.ts`): `createPairingCode(client, childId, { now, generate, customCode? })`.
   - Inserts `{ code, child_id, expires_at: now + 1h }`. On `error.code === "23505"` without `customCode`, generates a new code and retries: at most 1 + 3 = 4 inserts. Result `{ ok: true, code, expiresAt }` or `{ ok: false, reason: "in-use" | "custom-in-use" | "failed" }`.
   - `PAIRING_ERROR_MESSAGES`: `in-use` → "This code is already in use. Generate another code.", `custom-in-use` → "This code is already in use, please choose another", `failed` → "Could not create a code. Please try again.".
   - On `in-use` the page shows the message and a **Generate another code** button that posts the same action.

4. **Pair endpoint** (`app/api/device/pair/route.ts` → `apps/web/src/lib/pairing/pair-device.ts`): `pairDevice(deps, ip, body)` returns `{ status, body }`:
   1. `deps.registerAttempt(sha256Hex(ip))` → count in the last 10 minutes including this one; `> 10` → `429 { error: "rate_limited" }`. Counted before parsing, so malformed requests also count.
   2. `PairRequest.safeParse` fails → `400 { error: "invalid_request" }`. `normalizePairingCode` returns `null` → `400 { error: "invalid_code" }`.
   3. Token: 32 random bytes, base64url (43 chars). `deps.redeem(code, sha256Hex(token), browser, os)` → device id or `null`. `null` → `400 { error: "invalid_code" }` (same body for unknown, expired and used). Else `200 { deviceToken }`.
   - IP: first entry of `x-forwarded-for` (Vercel overwrites it), else `x-real-ip`, else `"unknown"`.
   - Deps are built in `src/lib/supabase/admin.ts` with the service-role key (server only) calling `rpc("register_pair_attempt")` and `rpc("redeem_pairing_code")`. An RPC error → `500 { error: "server_error" }`, never the error text.

5. **Migration** `supabase/migrations/<timestamp>_device_pairing.sql`:
   - `pair_attempts(id bigint identity pk, ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'), at timestamptz not null default now())`, index `(ip_hash, at)`, RLS enabled, no policies.
   - `register_pair_attempt(p_ip_hash text) returns int`: deletes all rows with `at < now() - interval '10 minutes'`, inserts one row, returns the count for `p_ip_hash` since then.
   - `redeem_pairing_code(p_code, p_token_hash, p_browser, p_os) returns uuid`: `delete from pairing_codes where code = p_code and expires_at > now() returning child_id`; none → `null`; else inserts the device and returns its id. One function call is one transaction, so two concurrent calls with the same code cannot both succeed (the row lock on delete serialises them).
   - Both `set search_path = ''`; `revoke execute ... from public, anon, authenticated; grant execute ... to service_role`.
   - Alternative: rate limit in memory; rejected, Vercel runs many short-lived instances. Alternative: Upstash/Vercel KV; rejected, new service.

## Risks / Trade-offs

- [IP hash is a new piece of stored data] → Not collected by the extension, only derived from the request; SHA-256, deleted on the next attempt after 10 minutes. Unsalted IPv4 hashes are reversible, so rows may linger if nobody pairs again; a later cleanup cron can purge them. Flagged for the human.
- [Code consumed but device insert fails] → Same transaction, so the delete rolls back.
- [Shared NAT (school) hits the IP limit] → 10 per 10 minutes is enough for one family; acceptable for MVP.
- [`x-forwarded-for` spoofing outside Vercel] → Only Vercel is supported.
- [Retry loop and unique-violation detection depend on supabase-js returning `error.code`] → PostgREST returns the SQLSTATE in `code`; tests use that shape.
