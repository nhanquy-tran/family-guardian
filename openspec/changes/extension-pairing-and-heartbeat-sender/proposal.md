## Why

Issue #11. The tracker (#4), heartbeat API (#10) and pair API (#9) exist, but the extension does not connect them yet. Without this no data reaches the dashboard and offline detection (ADR 0010) never sees a heartbeat.

## What Changes

- Options page: the child or parent enters the pairing code. The page detects the browser and sends `{ type: "pair", code, browser }` to the background, which runs the pairing inside the controller's serialized chain (no interleaving with a flush) and calls `POST /api/device/pair` with only `code`, `browser` and `os`, stores the device token in `chrome.storage.local` and shows "Connected". The API base URL comes from the build-time variable `WXT_API_BASE_URL`.
- Background: wires `tabs`, `windows` and `idle` events into the tracker, persists the tracker state across service-worker restarts, and runs a `chrome.alarms` alarm every minute.
- Each alarm moves completed minutes into a queue in `chrome.storage.local` and posts heartbeats: oldest first, at most `MAX_HEARTBEAT_ENTRIES` (1440) entries per request. A `200` drops the sent chunk, a `413` halves the chunk that was just sent, a `401` marks the device as rejected (token and queue are kept, tracking stops, a keep-alive retry runs every 15 minutes and a `200` recovers), and anything else keeps the queue for the next minute. Entries older than 7 days are pruned, matching the server's window.
- With an empty queue a heartbeat with `entries: []` is still sent (keep-alive for offline detection).
- Detects the browser (`chrome`, `edge`, `brave`, `other`) in the options page at pairing time and stores it; heartbeats send the stored value. The OS name comes from `runtime.getPlatformInfo()`.
- The options page shows "Disconnected. Ask your parent to pair this browser again." while the device is rejected.
- Request bodies are built from `HeartbeatRequest` / `PairRequest` only (ADR 0005).
- Logic lives in unit-tested `apps/extension/lib/` modules; entrypoints only wire browser APIs.

## Capabilities

### New Capabilities

- `extension-pairing`: options page pairing, token storage, API base URL.
- `heartbeat-sender`: background wiring, offline queue, chunked sending, browser detection.

### Modified Capabilities

None.

## Impact

- New files in `apps/extension/lib/` with tests, `apps/extension/.env.example` (`WXT_API_BASE_URL=`), rewritten `entrypoints/background.ts` and `entrypoints/options/*`.
- Uses `normalizePairingCode`, `PairRequest`, `PairResponse` (from #9), `HeartbeatRequest`, `HeartbeatResponse`, `MAX_HEARTBEAT_ENTRIES` from `@fg/shared`. No new dependency, no server change, no new data sent. No ADR needed: the local queue holds only domains, minutes and seconds already allowed by ADR 0005.
- Depends on: #4 (tracker, merged); #9 (pair API and shared contracts: `normalizePairingCode`, `PairRequest`, `PairResponse`) and #10 (heartbeat API, `MAX_HEARTBEAT_ENTRIES`, `413` contract). Build only after both #9 and #10 are merged; unit tests use fakes.

## Out of scope

- Showing the child's name: `PairResponse` (#9) returns only `deviceToken`. Adding `childName` changes #9's contract and needs an owner decision; a follow-up issue.
- Fetching rules and blocking when `rulesVersion` changes.
- Revoking the old device row on the server when the extension re-pairs (parent removes devices in the dashboard).
- Firefox, Safari, incognito, multiple profiles; backoff beyond the one-minute alarm.
