# Spec Delta

## Purpose

The extension's background turns browser events into tracked minutes, keeps them in an offline queue and sends them to `POST /api/device/heartbeat` every minute, in chunks, within the ADR 0005 limits.

Test files:
- `apps/extension/lib/queue.test.ts`: `enqueue`, `pruneQueue`, `parseQueue`.
- `apps/extension/lib/sender.test.ts`: `flushQueue` with an in-memory `KeyValueStore` fake and a `post` fake that records calls and answers from a script. Unless stated: now `2026-11-17T10:05:30Z`, token `tok-1`, base URL `https://fg.example`, browser `edge` (stored under `browser` in controller tests), extensionVersion `0.2.0`, currentDomain `null`, `200` body `{ rulesVersion: 3 }`. "Entry n" is `{ minuteUtc: <2026-11-17T00:00:00Z + n minutes>, domain: "example.com", seconds: 30 }`, so a higher n is newer.
- `apps/extension/lib/controller.test.ts`: `createController` and `registerSchedule` with the same fakes, fake `alarms` and `idle` objects, and a fixed browser info.
- `apps/extension/lib/browser-info.test.ts`: `detectBrowser`, `osName`.

## ADDED Requirements

### Requirement: Offline queue ordered and limited to 7 days
The queue SHALL be stored under `queue` in `chrome.storage.local`, sorted by `minuteUtc` then `domain`. `pruneQueue` and `enqueue` SHALL drop entries with `minuteUtc` earlier than now truncated to the UTC minute minus 7 days. `parseQueue` SHALL turn a stored value into a valid queue, keeping only items that pass `UsageEntry`.

#### Scenario: Oldest first
- **GIVEN** a queue `[{10:03, youtube.com}]`
- **WHEN** `enqueue` adds `[{10:04, a.com}, {10:02, b.com}, {10:03, khanacademy.org}]` (`queue.test.ts`)
- **THEN** the result is in the order `10:02 b.com`, `10:03 khanacademy.org`, `10:03 youtube.com`, `10:04 a.com`

#### Scenario: Seven-day limit
- **GIVEN** now `2026-11-17T10:05:30Z`
- **WHEN** `pruneQueue` runs on entries for `2026-11-10T10:04:00Z`, `2026-11-10T10:05:00Z` and `2026-11-17T10:04:00Z` (`queue.test.ts`)
- **THEN** only the `2026-11-10T10:05:00Z` and `2026-11-17T10:04:00Z` entries remain

#### Scenario: Corrupt stored queue
- **GIVEN** stored values `undefined`, `"x"`, `{}` and `[null, {"domain":"a.com"}, <valid entry>]`
- **WHEN** `parseQueue` is called on each (`queue.test.ts`)
- **THEN** it returns `[]`, `[]`, `[]` and `[<valid entry>]`

### Requirement: Heartbeat request contains only HeartbeatRequest fields
Each heartbeat SHALL be one `POST` to `<baseUrl>/api/device/heartbeat` with headers exactly `Authorization: Bearer <token>` and `Content-Type: application/json`, and a JSON body with exactly the keys `entries`, `currentDomain`, `browser`, `extensionVersion` that passes `HeartbeatRequest`. No URL, path, title or other field SHALL be sent.

#### Scenario: Request shape
- **GIVEN** a queue with entries 1 and 2 and currentDomain `youtube.com`
- **WHEN** `flushQueue` runs (`sender.test.ts`)
- **THEN** `post` was called once with URL `https://fg.example/api/device/heartbeat` and headers exactly `{ Authorization: "Bearer tok-1", "Content-Type": "application/json" }`
- **AND** the parsed body has exactly the keys `entries`, `currentDomain`, `browser`, `extensionVersion`, passes `HeartbeatRequest.parse`, and equals `{ entries: [entry 1, entry 2], currentDomain: "youtube.com", browser: "edge", extensionVersion: "0.2.0" }`

#### Scenario: No URL leaves the device
- **GIVEN** a paired controller that receives a focus event, an idle `active` event and a tab event with URL `https://www.youtube.com/watch?v=abc&t=10`, at `10:03:10Z`
- **WHEN** the alarm fires at `10:04:05Z` (`controller.test.ts`)
- **THEN** every request body and every value written to the store contains neither `https://`, `/watch`, `v=abc` nor `www.youtube.com`
- **AND** the sent entries contain domain `youtube.com`

### Requirement: Chunked sending oldest first
`flushQueue` SHALL send queued entries oldest first in chunks of at most `MAX_HEARTBEAT_ENTRIES`. After each `200` whose body passes `HeartbeatResponse` it SHALL write the queue without that chunk to the store and continue with the next chunk until the queue is empty, then return `{ kind: "ok", rulesVersion }`.

#### Scenario: Three chunks
- **GIVEN** a queue of entries 1 to 3000 and `post` always answering `200`
- **WHEN** `flushQueue` runs (`sender.test.ts`)
- **THEN** `post` was called 3 times with 1440, 1440 and 120 entries: entries 1-1440, 1441-2880, 2881-3000
- **AND** the stored queue is `[]` and the result is `{ kind: "ok", rulesVersion: 3 }`

#### Scenario: Queue saved after each chunk
- **GIVEN** a queue of entries 1 to 3000, `post` answering `200` and then rejecting with `TypeError("Failed to fetch")`
- **WHEN** `flushQueue` runs (`sender.test.ts`)
- **THEN** `post` was called 2 times and the result is `{ kind: "failed" }`
- **AND** the stored queue is entries 1441 to 3000 in order

#### Scenario: Empty queue still sends a keep-alive
- **GIVEN** an empty queue
- **WHEN** `flushQueue` runs (`sender.test.ts`)
- **THEN** `post` was called once with `entries: []` and the result is `{ kind: "ok", rulesVersion: 3 }`

#### Scenario: Pruned before sending
- **GIVEN** a queue with one entry for `2026-11-10T10:04:00Z` and one for `2026-11-17T10:04:00Z`
- **WHEN** `flushQueue` runs (`sender.test.ts`)
- **THEN** the only request contains just the `2026-11-17T10:04:00Z` entry

### Requirement: Too many entries splits the batch
On `413` `flushQueue` SHALL set the next chunk size to `floor(sent.length / 2)`, where `sent` is the chunk just sent, and resend from the same oldest entry, keeping the queue unchanged; when that size is 0 it SHALL stop with `{ kind: "failed" }`.

#### Scenario: Split after 413
- **GIVEN** a queue of entries 1 to 1440 and `post` answering `413 { error: "too_many_entries" }` once, then `200`
- **WHEN** `flushQueue` runs (`sender.test.ts`)
- **THEN** the requests contain 1440, then 720 (entries 1-720), then 720 (entries 721-1440) entries
- **AND** the stored queue is `[]`

#### Scenario: Split uses the length actually sent
- **GIVEN** a queue of entries 1 to 3 and `post` answering `413` once, then `200`
- **WHEN** `flushQueue` runs (`sender.test.ts`)
- **THEN** the requests contain 3 entries, then 1 entry (entry 1), then 1 entry (entry 2), then 1 entry (entry 3)

#### Scenario: 413 for a single entry stops
- **GIVEN** a queue of entry 1 and `post` always answering `413`
- **WHEN** `flushQueue` runs (`sender.test.ts`)
- **THEN** `post` was called exactly once, the result is `{ kind: "failed" }` and the stored queue is still `[entry 1]`

### Requirement: Failures keep the queue
For `400`, `500`, any other non-`200` status except `401` and `413`, a `200` body that fails `HeartbeatResponse`, or a rejected `post` (network error or 30 s timeout), `flushQueue` SHALL stop, return `{ kind: "failed" }`, and leave the stored queue unchanged. If writing the queue after a `200` fails, it SHALL stop with `{ kind: "failed" }` without throwing. None of these SHALL throw.

#### Scenario: Server and network failures
- **GIVEN** a queue of entries 1 and 2
- **WHEN** `flushQueue` runs once each with `post` answering `400 { error: "invalid_request" }`, `500 { error: "server_error" }`, `503` with a non-JSON body, `200 { ok: true }`, and rejecting with `TypeError("Failed to fetch")` (`sender.test.ts`)
- **THEN** each result is `{ kind: "failed" }`, `post` was called once per run, and the stored queue is still `[entry 1, entry 2]`

#### Scenario: Store write fails after 200
- **GIVEN** a queue of entries 1 to 3000, `post` always answering `200`, and a store whose `set` rejects
- **WHEN** `flushQueue` runs (`sender.test.ts`)
- **THEN** `post` was called once, the result is `{ kind: "failed" }`, and it does not throw

### Requirement: Unauthorized marks the device rejected
On `401` `flushQueue` SHALL stop and return `{ kind: "unauthorized" }`. The controller SHALL then keep `deviceToken` and `queue`, set `authState` to `"rejected"`, and stop tracking new minutes. Local data SHALL be replaced only by a successful re-pair.

#### Scenario: First 401
- **GIVEN** a paired controller with 2 queued entries and `post` answering `401 { error: "unauthorized" }`
- **WHEN** the alarm fires (`controller.test.ts`)
- **THEN** `post` was called once
- **AND** the store still holds `deviceToken` `"tok-1"` and the 2 queued entries, and `authState` is `"rejected"`
- **AND** `connectionStatus(store)` returns `"rejected"`

### Requirement: Rejected device retries every 15 minutes
While rejected, `onAlarm(now)` SHALL prune the queue, SHALL NOT tick the tracker or enqueue entries, and SHALL send a heartbeat with `entries: []` and `currentDomain: null` only when `floor(now / 60000) % 15 === 0`. On a `200` it SHALL remove `authState` and `trackerState`; on `401` or any failure it SHALL stay rejected.

#### Scenario: Rejected device stops tracking
- **GIVEN** a rejected controller and a tab event for `https://www.youtube.com/` with focus and idle `active`
- **WHEN** the alarms fire at `10:01:05Z` and `10:02:05Z` (not 15-minute boundaries) (`controller.test.ts`)
- **THEN** `post` was not called and nothing was added to the queue
- **AND** the stored `trackerState` is unchanged by the events

#### Scenario: Retry every 15 minutes with an empty body
- **GIVEN** a rejected controller with 2 queued entries and `post` answering `401`
- **WHEN** the alarm fires at `10:14:05Z`, `10:15:05Z`, `10:16:05Z` and `10:30:05Z` (`controller.test.ts`)
- **THEN** `post` was called at `10:15:05Z` and `10:30:05Z` only, each with `entries: []` and `currentDomain: null`
- **AND** the store still holds `deviceToken`, the 2 queued entries and `authState` `"rejected"`

#### Scenario: Recovery on 200
- **GIVEN** a rejected controller with 2 queued entries and a `trackerState`, and `post` answering `200`
- **WHEN** the alarm fires at `10:15:05Z`, then at `10:16:05Z` (`controller.test.ts`)
- **THEN** after the first alarm the store has no `authState` and no `trackerState` key and still holds `deviceToken`
- **AND** the request at `10:16:05Z` contains the 2 queued entries and the queue is then `[]`

#### Scenario: Pruning continues while rejected
- **GIVEN** a rejected controller with an entry for `2026-11-10T10:04:00Z` and one for `2026-11-17T10:04:00Z`
- **WHEN** the alarm fires at `10:01:05Z` on `2026-11-17` (`controller.test.ts`)
- **THEN** the stored queue contains only the `2026-11-17T10:04:00Z` entry

#### Scenario: Re-pair while rejected
- **GIVEN** a rejected controller with `deviceToken` `"old"`, queued entries, and a `post` answering the pair request with `200 { deviceToken: "tok-2" }`
- **WHEN** `controller.pair("AB2CD3", "edge")` completes and the alarm fires (`controller.test.ts`)
- **THEN** the store has `deviceToken` `"tok-2"` and no `authState`, and the old queue is gone
- **AND** tracking works again: events are applied and the next heartbeat uses `Bearer tok-2`

### Requirement: Minute alarm and idle threshold
`registerSchedule` SHALL create alarm `heartbeat` with `periodInMinutes: 1` and set the idle detection interval to 60 seconds.

#### Scenario: Schedule registered
- **GIVEN** fake `alarms` and `idle` objects
- **WHEN** `registerSchedule({ alarms, idle })` runs (`controller.test.ts`)
- **THEN** `alarms.create` was called with `("heartbeat", { periodInMinutes: 1 })` and `idle.setDetectionInterval` with `60`

### Requirement: Background tracks and sends while paired
While paired and not rejected, `handleEvent` SHALL apply the event to the stored tracker state and save it; `onAlarm(now)` SHALL apply a tick, move completed minutes into the queue, and call `flushQueue` with `currentDomain` set to the tracker's domain when focused and `active`, else `null`. While not paired, both SHALL do nothing and store nothing.

#### Scenario: Completed minute is sent
- **GIVEN** a paired controller, `post` answering `200`, and events focus `true`, idle `active`, tab `https://www.youtube.com/` at `10:03:00Z`
- **WHEN** the alarm fires at `10:04:05Z` (`controller.test.ts`)
- **THEN** one request was sent whose `entries` include `{ minuteUtc: "2026-11-17T10:03:00.000Z", domain: "youtube.com", seconds: 60 }` and whose `currentDomain` is `youtube.com`
- **AND** the stored queue is `[]`

#### Scenario: Current domain null when not active
- **GIVEN** a paired controller with tab `https://www.youtube.com/`, and then focus `false`
- **WHEN** the alarm fires (`controller.test.ts`)
- **THEN** the request's `currentDomain` is `null`

#### Scenario: Not paired
- **GIVEN** a controller with an empty store
- **WHEN** it receives focus, idle and tab events and the alarm fires (`controller.test.ts`)
- **THEN** `post` was never called and the store is still empty

#### Scenario: Offline minutes are queued and sent later in order
- **GIVEN** a paired controller with tab `https://khanacademy.org/` focused and active from `10:00:00Z`, and `post` rejecting
- **WHEN** the alarm fires at `10:01:05Z`, `10:02:05Z` and `10:03:05Z`, then `post` answers `200` and the alarm fires at `10:04:05Z` (`controller.test.ts`)
- **THEN** the last request's `entries` are the minutes `10:00`, `10:01`, `10:02` and `10:03` for `khanacademy.org` in that order
- **AND** the stored queue is `[]`

#### Scenario: Tracker state survives a service-worker restart
- **GIVEN** a paired controller that received focus, idle `active` and tab `https://khanacademy.org/` at `10:03:00Z`
- **WHEN** a new controller is created on the same store and its alarm fires at `10:04:05Z` (`controller.test.ts`)
- **THEN** the request includes `{ minuteUtc: "2026-11-17T10:03:00.000Z", domain: "khanacademy.org", seconds: 60 }`

### Requirement: Serialized calls and stored browser
Heartbeats SHALL send the stored `browser`, or `other` if missing or invalid. `handleEvent`, `onAlarm` and `pair(code, browser)` SHALL run one at a time in call order, so a re-pair never interleaves with a flush, and SHALL NOT reject.

#### Scenario: No overlapping runs
- **GIVEN** a paired controller with 2 queued entries and a `post` fake that resolves `200` only when the test releases it
- **WHEN** `onAlarm` is called twice without awaiting, then the first `post` is released (`controller.test.ts`)
- **THEN** the second `post` starts only after the first resolved, and no entry appears in two requests

#### Scenario: Stored browser is sent
- **GIVEN** a paired controller with `browser` `"brave"` in the store, then one with no `browser` key and one with `browser` `"netscape"`
- **WHEN** the alarm fires on each (`controller.test.ts`)
- **THEN** the request bodies contain `browser` `"brave"`, `"other"` and `"other"`

#### Scenario: Pairing is serialized with a flush
- **GIVEN** a paired controller with `deviceToken` `"old"` and 2 queued entries, a `post` fake whose heartbeat call resolves `200` only when the test releases it, and a pair request answered `200 { deviceToken: "tok-2" }`
- **WHEN** `onAlarm` is called, then `pair("AB2CD3", "edge")` without awaiting either, then the heartbeat is released (`controller.test.ts`)
- **THEN** the pair request is sent only after the heartbeat resolved
- **AND** the final store holds `deviceToken` `"tok-2"` and no queue entries from the old pairing (the old minutes are not written back after the token change)

#### Scenario: Storage failure does not crash
- **GIVEN** a store whose `get` rejects
- **WHEN** `handleEvent` and `onAlarm` are called (`controller.test.ts`)
- **THEN** both promises resolve, `post` was never called, and the logged message contains no domain, token or URL

### Requirement: Browser and OS detection
`detectBrowser({ brands, userAgent, isBrave })`, called by the options page at pairing time, SHALL return `brave` when `isBrave`, else `edge` for the `Microsoft Edge` brand or `Edg/` in the user agent, else `other` for `OPR/`, else `chrome` for the `Google Chrome` brand or `Chrome/`, else `other`. `osName` SHALL map `win`, `mac`, `linux`, `cros` to `Windows`, `macOS`, `Linux`, `ChromeOS`, and anything else to `other`.

#### Scenario: Browsers
- **GIVEN** the inputs below (`browser-info.test.ts`)
- **WHEN** `detectBrowser` is called with: `isBrave: true` and Chrome UA; brands `["Microsoft Edge", "Chromium"]`; no brands and UA `... Chrome/130.0 Safari/537.36 Edg/130.0`; no brands and UA `... Chrome/130.0 Safari/537.36 OPR/115.0`; brands `["Google Chrome", "Chromium"]`; no brands and UA `... Chrome/130.0 Safari/537.36`; no brands and UA `Mozilla/5.0 (X11) Firefox/130.0`
- **THEN** the results are `brave`, `edge`, `edge`, `other`, `chrome`, `chrome`, `other`

#### Scenario: Operating systems
- **GIVEN** `osName`
- **WHEN** it is called with `win`, `mac`, `linux`, `cros`, `android` (`browser-info.test.ts`)
- **THEN** it returns `Windows`, `macOS`, `Linux`, `ChromeOS`, `other`
