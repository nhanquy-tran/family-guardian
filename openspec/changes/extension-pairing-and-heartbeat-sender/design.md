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
   - `lib/browser-info.ts`: `detectBrowser({ brands, userAgent, isBrave })` (called by the options page only), `osName(platformOs)`.
   - `lib/pairing.ts`: `pairWithCode(deps, rawCode)` (`deps` include the `browser` detected by the options page), `PAIR_MESSAGES`, `connectionStatus(store)`.
   - `lib/queue.ts`: `enqueue(queue, entries, now)`, `pruneQueue(queue, now)`, `parseQueue(raw)`.
   - `lib/sender.ts`: `flushQueue(deps)`.
   - `lib/controller.ts`: `createController(deps)` with `handleEvent(event)`, `onAlarm(now)`, `pair(code, browser)` and `registerSchedule(api)`.
   `background.ts` and `options/main.ts` only translate `browser.*` calls into these. The `KeyValueStore` adapter over `browser.storage.local` is a few lines in `lib/storage.ts`; the `Post` adapter wraps `fetch` with `method: "POST"` and `signal: AbortSignal.timeout(30_000)`.

2. **Storage keys** in `chrome.storage.local`: `deviceToken` (string), `queue` (`UsageEntry[]`), `trackerState` (`TrackerState`), `authState` (the string `"rejected"`, absent otherwise) and `browser` (`chrome | edge | brave | other`). Nothing else. Stored values are validated on read: a non-string token counts as unpaired; `parseQueue` keeps only items that pass `UsageEntry` and drops the rest; an invalid tracker state is replaced by `createTracker()`; any `authState` other than `"rejected"` counts as absent; a missing or invalid `browser` is sent as `other`.

3. **No tracking before pairing or while rejected.** Without a token, `handleEvent` and `onAlarm` do nothing and store nothing. Privacy by default; no data with no destination. While `authState` is `"rejected"` no new minutes are tracked either (see decision 6).

4. **Queue.** Sorted by `minuteUtc`, then `domain` (oldest first). `pruneQueue` drops entries with `minuteUtc < m0 - 7 days` where `m0` is now truncated to the UTC minute, the same bound as the server, so the queue is bounded (about 10 080 minutes times the domains used per minute; well under the 10 MB `storage.local` quota for MVP use). `enqueue` appends, prunes, sorts.

5. **Sending (`flushQueue`).** Inputs: `{ now, token, baseUrl, browser, extensionVersion, currentDomain, keepAliveOnly, store, post }` (`browser` is the stored value, `other` if missing). Steps:
   - Read and prune the queue. If empty, send one request with `entries: []` (keep-alive for ADR 0010) and stop.
   - Otherwise `size = MAX_HEARTBEAT_ENTRIES`; loop while the queue is not empty: send the first `min(size, queue.length)` entries.
     - `200` with a body that passes `HeartbeatResponse`: write the queue without the chunk to the store, then continue. A store write failure stops the flush with result `failed`; the chunk is resent next time (idempotent upsert).
     - `413`: `size = floor(sent.length / 2)` where `sent` is the chunk just sent (not the previous `size`); if `size` is 0, stop with `failed`. The queue is unchanged. A single entry that gets `413` therefore causes exactly one call.
     - `401`: stop with result `unauthorized`.
     - Anything else (`400`, `5xx`, other status, `200` with an invalid body, thrown/timeout error): stop with `failed`; queue unchanged.
   - Result: `{ kind: "ok", rulesVersion } | { kind: "failed" } | { kind: "unauthorized" }`. The `rulesVersion` is returned but not used yet (blocking change).
   - A `keepAliveOnly` input makes `flushQueue` send exactly one request with `entries: []` and leave the queue untouched (used while rejected, decision 6).
   - Request: `POST ${baseUrl}/api/device/heartbeat`, headers exactly `Authorization: Bearer <token>` and `Content-Type: application/json`, body `JSON.stringify(HeartbeatRequest.parse({ entries, currentDomain, browser, extensionVersion }))`. Building the body from the schema means no other field can be sent.
   - No backoff: the one-minute alarm is the retry interval (60 devices, fine for MVP).

6. **Unauthorized means rejected, not unpaired.** A `401` can also come from a server bug (for example a token-hash mismatch after a deploy); wiping local state would unpair every child laptop at once and need a visit to each. So on the first `401` the controller keeps `deviceToken` and `queue`, sets `authState` to `"rejected"` and:
   - stops tracking new minutes (`handleEvent` does nothing; `onAlarm` neither ticks nor enqueues) and drops the stored `trackerState` on recovery, because the events during the gap were missed;
   - still prunes the queue (entries older than 7 days);
   - retries only every 15 minutes, with a keep-alive heartbeat (`entries: []`, `currentDomain: null`): `onAlarm` sends only when `floor(now / 60000) % 15 === 0`. This is stateless on purpose, because the alarm wakes a fresh service worker every minute and in-memory timers are lost;
   - on a `200` removes `authState` and `trackerState`; tracking resumes and the queue is sent by the next normal alarm. On `401` or any failure it stays rejected;
   - the options page shows "Disconnected. Ask your parent to pair this browser again." (`connectionStatus` returns `"rejected"`).
   The parent learns about it through the offline alert (#18). Local data is replaced only by an explicit successful re-pair (decision 9).

7. **Controller.**
   - `handleEvent(event)`: if paired, load tracker state, `applyEvent`, save.
   - `onAlarm(now)`: if paired, apply `{ type: "tick", at: now }`, `takeCompletedEntries`, save the tracker state, `enqueue` the entries and save the queue, then `flushQueue` with `currentDomain` = tracker `domain` when `focused && idle === "active"`, else `null`. On `unauthorized`, set `authState` as in decision 6. While rejected, `onAlarm` only prunes the queue and, on a 15-minute boundary, sends the keep-alive.
   - `pair(code, browser)`: runs `pairWithCode` inside the same chain. The options page sends the runtime message `{ type: "pair", code, browser }` (`browser` detected there, decision 11); the background calls `controller.pair` and replies with the result. A flush in flight finishes first, so a re-pair never interleaves with a flush and old minutes cannot be written back after the token changes.
   - All calls (`handleEvent`, `onAlarm`, `pair`) run through one promise chain (`serialize`), so an alarm never overlaps another alarm, an event or a pairing, and the queue is never read-modify-written twice at once.
   - Any thrown error (storage read, unexpected) is caught and logged with a fixed message (no domain, token or URL); the promise does not reject, so the service worker has no unhandled rejection.
   - `registerSchedule({ alarms, idle })`: `alarms.create("heartbeat", { periodInMinutes: 1 })` and `idle.setDetectionInterval(60)`.

8. **Background wiring** (`background.ts`, thin, not unit-tested): listeners registered synchronously in `defineBackground` (MV3 requirement): `tabs.onActivated` (get the tab's URL), `tabs.onUpdated` with `changeInfo.url` on the active tab of the focused window, `windows.onFocusChanged` (`WINDOW_ID_NONE` → `focus false`, otherwise `focus true` and the window's active tab URL), `idle.onStateChanged`, `alarms.onAlarm` (name `heartbeat`) → `controller.onAlarm(Date.now())`. On startup and install: `registerSchedule`. `extensionVersion` (`runtime.getManifest().version`) is read once per alarm and `browser` from storage (decision 11). The background listens for `runtime.onMessage` with `{ type: "pair", code, browser }`, adds `os` from `runtime.getPlatformInfo()` and answers with the `pairWithCode` result. The URL is passed only to `applyEvent`, which keeps the registrable domain.

9. **Pairing (`pairWithCode`).** `normalizePairingCode` → `null` → `invalid_code` without a request. Otherwise `POST ${baseUrl}/api/device/pair`, header `Content-Type: application/json`, body `JSON.stringify(PairRequest.parse({ code, browser, os }))`.
   - `200` with a valid `PairResponse`: remove `queue`, `trackerState` and `authState`, then set `browser` and `deviceToken` (replacing any old token, so the old token is no longer used). Removing first ensures no minutes recorded under a previous pairing are sent with the new token. A store failure → `failed`.
   - `400 { error: "invalid_code" }` → `invalid_code`; `429` → `rate_limited`; anything else, an invalid body or a thrown error → `failed`. On every failure the stored token, queue and tracker state are unchanged, so a wrong code cannot disconnect a paired device.
   - `PAIR_MESSAGES`: `invalid_code` "This code is not valid or has expired. Ask your parent for a new code.", `rate_limited` "Too many attempts. Please wait 10 minutes and try again.", `failed` "Could not connect. Check the internet connection and try again.", `misconfigured` "This extension is not set up correctly. Ask your parent to reinstall it.".

10. **API base URL.** `resolveApiBaseUrl(import.meta.env.WXT_API_BASE_URL)`: must parse as a URL with protocol `https:`, or `http:` with host `localhost` or `127.0.0.1` (development); a trailing `/` is removed. Otherwise it throws an error naming `WXT_API_BASE_URL`. It is checked at runtime, not at build time, so CI builds without the variable still pass: the options page then shows `PAIR_MESSAGES.misconfigured` and the background sends nothing. `apps/extension/.env.example` documents the name only.

11. **Browser and OS.** `navigator.brave` is not guaranteed in the MV3 service worker, so the browser is detected in the options page at pairing time with `detectBrowser`: `isBrave` (`typeof navigator.brave?.isBrave === "function"`) → `brave`; else `brands` contains `Microsoft Edge` or the user agent contains `Edg/` → `edge`; else user agent contains `OPR/` → `other`; else `brands` contains `Google Chrome` or user agent contains `Chrome/` → `chrome`; else `other`. The value is sent in the `pair` message, used in the `PairRequest`, stored under `browser` on success, and sent in every heartbeat from storage (`other` if missing or invalid). `osName` maps `runtime.getPlatformInfo().os` (read in the background when pairing): `win` → `Windows`, `mac` → `macOS`, `linux` → `Linux`, `cros` → `ChromeOS`, anything else → `other`.

## Risks / Trade-offs

- [Depends on #9 and #10 shared contracts] → Build only after both are merged: #10 (`MAX_HEARTBEAT_ENTRIES`, `HeartbeatRequest`/`HeartbeatResponse`, the `413` contract) and #9 (`normalizePairingCode`, `PairRequest`, `PairResponse` in `@fg/shared`). Tests use fakes.
- [A server bug answers 401 to every device] → Devices keep their token and queue, stop tracking and retry every 15 minutes; they recover on their own once the server is fixed. Cost: minutes during the outage are not tracked.
- [Re-pairing leaves the old device row on the server] → It stops sending and shows as offline; the parent removes it. Server-side revocation is out of scope.
- [A child could remove the token by entering nothing] → Not possible: only a successful pair replaces the token. Uninstall is prevented by the force-install policy.
- [Laptop asleep longer than 7 days] → Older minutes are pruned; the server would skip them anyway.
- [Service worker killed mid-flush] → At most the current chunk is resent; idempotent on the server.
- [Clock skew] → Server skips entries beyond its window; the extension drops them after `200`.
