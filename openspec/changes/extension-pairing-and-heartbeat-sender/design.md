# Design

## Context

Architecture flows 2 (Pair) and 3 (Track). Existing pieces:
- `apps/extension/lib/tracker.ts` (#4): `createTracker`, `applyEvent(state, TrackerEvent)`, `takeCompletedEntries(state, now)`; state is plain JSON; tab events carry a URL that is reduced to `registrableDomain` immediately.
- `POST /api/device/heartbeat` (#10, spec in `openspec/changes/add-heartbeat-api`): `Authorization: Bearer <token>`, body `HeartbeatRequest`; `200 { rulesVersion }`, `400 invalid_request`, `401 unauthorized`, `413 too_many_entries`, `500 server_error`. Skips stale/invalid entries itself; upserts are idempotent, so resending a chunk is harmless. Accepts minutes from `m0 - 7 days` to `m0 + 5 min`.
- `POST /api/device/pair` (#9): body `PairRequest { code, browser, os }`; `200 PairResponse { deviceToken }`, `400 invalid_code | invalid_request`, `429 rate_limited`, `500 server_error`. `normalizePairingCode` in `@fg/shared`.
- `wxt.config.ts` already has `tabs`, `idle`, `storage`, `alarms` and `<all_urls>`. WXT exposes `WXT_*` env variables via `import.meta.env`.

## Goals / Non-Goals

**Goals:** a paired extension sends every completed minute exactly once eventually (at-least-once, idempotent server), survives offline periods up to 7 days and service-worker restarts, never sends more than ADR 0005 allows, and all logic is unit-tested without a browser.

**Non-Goals:** rules fetching and blocking, child name, server-side revocation (see proposal).

## Decisions

1. **Pure modules with injected dependencies.** Browser APIs are passed in, so tests use fakes and the root `vitest.config.ts` (already matching `apps/extension/lib/**/*.test.ts`) runs them:
   ```ts
   interface KeyValueStore { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void>; remove(keys: string[]): Promise<void> }
   type Post = (url: string, init: { headers: Record<string, string>; body: string }) => Promise<{ status: number; json(): Promise<unknown> }>
   ```
   - `lib/config.ts`: `resolveApiBaseUrl(raw: string | undefined): string`.
   - `lib/browser-info.ts`: `detectBrowser({ brands, userAgent, isBrave })`, `osName(platformOs)`.
   - `lib/pairing.ts`: `pairWithCode(deps, rawCode)`, `PAIR_MESSAGES`, `connectionStatus(store)`.
   - `lib/queue.ts`: `enqueue(queue, entries, now)`, `pruneQueue(queue, now)`, `parseQueue(raw)`.
   - `lib/sender.ts`: `flushQueue(deps)`.
   - `lib/controller.ts`: `createController(deps)` with `handleEvent(event)`, `onAlarm(now)`, and `registerSchedule(api)`.
   `background.ts` and `options/main.ts` only translate `browser.*` calls into these. The `KeyValueStore` adapter over `browser.storage.local` is a few lines in `lib/storage.ts`; the `Post` adapter wraps `fetch` with `method: "POST"` and `signal: AbortSignal.timeout(30_000)`.

2. **Storage keys** in `chrome.storage.local`: `deviceToken` (string), `queue` (`UsageEntry[]`), `trackerState` (`TrackerState`). Nothing else. Stored values are validated on read: a non-string token counts as unpaired; `parseQueue` keeps only items that pass `UsageEntry` and drops the rest; an invalid tracker state is replaced by `createTracker()`.

3. **No tracking before pairing.** Without a token, `handleEvent` and `onAlarm` do nothing and store nothing. Privacy by default; no data with no destination.

4. **Queue.** Sorted by `minuteUtc`, then `domain` (oldest first). `pruneQueue` drops entries with `minuteUtc < m0 - 7 days` where `m0` is now truncated to the UTC minute, the same bound as the server, so the queue is bounded (about 10 080 minutes times the domains used per minute; well under the 10 MB `storage.local` quota for MVP use). `enqueue` appends, prunes, sorts.

5. **Sending (`flushQueue`).** Inputs: `{ now, token, baseUrl, browser, extensionVersion, currentDomain, store, post }`. Steps:
   - Read and prune the queue. If empty, send one request with `entries: []` (keep-alive for ADR 0010) and stop.
   - Otherwise `size = MAX_HEARTBEAT_ENTRIES`; loop while the queue is not empty: send the first `min(size, queue.length)` entries.
     - `200` with a body that passes `HeartbeatResponse`: write the queue without the chunk to the store, then continue. A store write failure stops the flush with result `failed`; the chunk is resent next time (idempotent upsert).
     - `413`: `size = floor(size / 2)`; if `size` is 0, stop with `failed`. The queue is unchanged.
     - `401`: stop with result `unauthorized`.
     - Anything else (`400`, `5xx`, other status, `200` with an invalid body, thrown/timeout error): stop with `failed`; queue unchanged.
   - Result: `{ kind: "ok", rulesVersion } | { kind: "failed" } | { kind: "unauthorized" }`. The `rulesVersion` is returned but not used yet (blocking change).
   - Request: `POST ${baseUrl}/api/device/heartbeat`, headers exactly `Authorization: Bearer <token>` and `Content-Type: application/json`, body `JSON.stringify(HeartbeatRequest.parse({ entries, currentDomain, browser, extensionVersion }))`. Building the body from the schema means no other field can be sent.
   - No backoff: the one-minute alarm is the retry interval (60 devices, fine for MVP).

6. **Unauthorized means unpaired.** A `401` means the token is unknown or the parent deleted the device. The controller removes `deviceToken`, `queue` and `trackerState`; the options page then shows "Not connected". The queued minutes have no device to belong to, so keeping them would only hold browsing data with no purpose. This is an automatic local cleanup, not a parent-facing delete.

7. **Controller.**
   - `handleEvent(event)`: if paired, load tracker state, `applyEvent`, save.
   - `onAlarm(now)`: if paired, apply `{ type: "tick", at: now }`, `takeCompletedEntries`, save the tracker state, `enqueue` the entries and save the queue, then `flushQueue` with `currentDomain` = tracker `domain` when `focused && idle === "active"`, else `null`. On `unauthorized`, clear as in decision 6.
   - All calls run through one promise chain (`serialize`), so an alarm never overlaps another alarm or an event and the queue is never read-modify-written twice at once.
   - Any thrown error (storage read, unexpected) is caught and logged with a fixed message (no domain, token or URL); the promise does not reject, so the service worker has no unhandled rejection.
   - `registerSchedule({ alarms, idle })`: `alarms.create("heartbeat", { periodInMinutes: 1 })` and `idle.setDetectionInterval(60)`.

8. **Background wiring** (`background.ts`, thin, not unit-tested): listeners registered synchronously in `defineBackground` (MV3 requirement): `tabs.onActivated` (get the tab's URL), `tabs.onUpdated` with `changeInfo.url` on the active tab of the focused window, `windows.onFocusChanged` (`WINDOW_ID_NONE` → `focus false`, otherwise `focus true` and the window's active tab URL), `idle.onStateChanged`, `alarms.onAlarm` (name `heartbeat`) → `controller.onAlarm(Date.now())`. On startup and install: `registerSchedule`. `browser`, `os` and `extensionVersion` (`runtime.getManifest().version`) are read once per alarm. The URL is passed only to `applyEvent`, which keeps the registrable domain.

9. **Pairing (`pairWithCode`).** `normalizePairingCode` → `null` → `invalid_code` without a request. Otherwise `POST ${baseUrl}/api/device/pair`, header `Content-Type: application/json`, body `JSON.stringify(PairRequest.parse({ code, browser, os }))`.
   - `200` with a valid `PairResponse`: remove `queue` and `trackerState`, then set `deviceToken` (replacing any old token, so the old token is no longer used). Removing first ensures no minutes recorded under a previous pairing are sent with the new token. A store failure → `failed`.
   - `400 { error: "invalid_code" }` → `invalid_code`; `429` → `rate_limited`; anything else, an invalid body or a thrown error → `failed`. On every failure the stored token, queue and tracker state are unchanged, so a wrong code cannot disconnect a paired device.
   - `PAIR_MESSAGES`: `invalid_code` "This code is not valid or has expired. Ask your parent for a new code.", `rate_limited` "Too many attempts. Please wait 10 minutes and try again.", `failed` "Could not connect. Check the internet connection and try again.", `misconfigured` "This extension is not set up correctly. Ask your parent to reinstall it.".

10. **API base URL.** `resolveApiBaseUrl(import.meta.env.WXT_API_BASE_URL)`: must parse as a URL with protocol `https:`, or `http:` with host `localhost` or `127.0.0.1` (development); a trailing `/` is removed. Otherwise it throws an error naming `WXT_API_BASE_URL`. It is checked at runtime, not at build time, so CI builds without the variable still pass: the options page then shows `PAIR_MESSAGES.misconfigured` and the background sends nothing. `apps/extension/.env.example` documents the name only.

11. **Browser and OS.** `detectBrowser`: `isBrave` (`typeof navigator.brave?.isBrave === "function"`) → `brave`; else `brands` contains `Microsoft Edge` or the user agent contains `Edg/` → `edge`; else user agent contains `OPR/` → `other`; else `brands` contains `Google Chrome` or user agent contains `Chrome/` → `chrome`; else `other`. `osName` maps `runtime.getPlatformInfo().os`: `win` → `Windows`, `mac` → `macOS`, `linux` → `Linux`, `cros` → `ChromeOS`, anything else → `other`.

## Risks / Trade-offs

- [Depends on #9's shared contracts] → Build only after #9 (`normalizePairingCode`, `PairRequest`, `PairResponse` in `@fg/shared`) is merged. #10 must be deployed for real use; tests use fakes.
- [Re-pairing leaves the old device row on the server] → It stops sending and shows as offline; the parent removes it. Server-side revocation is out of scope.
- [A child could remove the token by entering nothing] → Not possible: only a successful pair replaces the token. Uninstall is prevented by the force-install policy.
- [Laptop asleep longer than 7 days] → Older minutes are pruned; the server would skip them anyway.
- [Service worker killed mid-flush] → At most the current chunk is resent; idempotent on the server.
- [Clock skew] → Server skips entries beyond its window; the extension drops them after `200`.
