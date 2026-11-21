## MODIFIED Requirements

### Requirement: Heartbeat request contains only HeartbeatRequest fields
Each heartbeat SHALL be one `POST` to `<baseUrl>/api/device/heartbeat` with headers exactly `Authorization: Bearer <token>` and `Content-Type: application/json`, and a JSON body with exactly the keys `entries`, `currentDomain`, `browser`, `extensionVersion`, plus `siteAccess` (boolean) only when the check answered, and passes `HeartbeatRequest`. No URL, path, title or other field SHALL be sent.

#### Scenario: Request shape
- **GIVEN** a queue with entries 1 and 2 and currentDomain `youtube.com`, and no site-access answer
- **WHEN** `flushQueue` runs (`sender.test.ts`)
- **THEN** `post` was called once with URL `https://fg.example/api/device/heartbeat` and headers exactly `{ Authorization: "Bearer tok-1", "Content-Type": "application/json" }`
- **AND** the parsed body has exactly the keys `entries`, `currentDomain`, `browser`, `extensionVersion`, passes `HeartbeatRequest.parse`, and equals `{ entries: [entry 1, entry 2], currentDomain: "youtube.com", browser: "edge", extensionVersion: "0.2.0" }`

#### Scenario: No URL leaves the device
- **GIVEN** a paired controller that receives a focus event, an idle `active` event and a tab event with URL `https://www.youtube.com/watch?v=abc&t=10`, at `10:03:10Z`
- **WHEN** the alarm fires at `10:04:05Z` (`controller.test.ts`)
- **THEN** every request body and every value written to the store contains neither `https://`, `/watch`, `v=abc` nor `www.youtube.com`
- **AND** the sent entries contain domain `youtube.com`

## ADDED Requirements

### Requirement: The heartbeat reports whether the extension still has access to all sites
On every `onAlarm`, before sending, the controller SHALL call the injected `permissions.contains({ origins: ["<all_urls>"] })` and send the boolean as `siteAccess` in every heartbeat of that alarm, including a rejected device's keep-alive. If the call rejects or `permissions` is missing, `siteAccess` SHALL be omitted, the failure logged without detail, and the heartbeat still sent. The value SHALL NOT be stored locally.

#### Scenario: Value follows the browser
File: `apps/extension/src/lib/controller.test.ts`
- **GIVEN** a paired controller whose `permissions.contains` answers `true`, `false`, then `true`, and a rejected controller whose answer is `false`
- **WHEN** the alarm fires three times on the first, and at `10:15:05Z` on the second
- **THEN** `permissions.contains` was called with `{ origins: ["<all_urls>"] }` each time, and the bodies carry `siteAccess` `true`, `false`, `true`, with exactly the keys `entries`, `currentDomain`, `browser`, `extensionVersion`, `siteAccess`, passing `HeartbeatRequest.parse`
- **AND** a controller whose `permissions.contains` rejects, and another created without `permissions`, each send one heartbeat without a `siteAccess` key and do not throw, and the logged message contains no domain, token or URL
- **AND** the rejected controller's request has `entries: []` and `siteAccess` `false`, and no store key contains the site-access value

### Requirement: The extension keeps API-origin access locally
On every `onAlarm` the controller SHALL also call `permissions.contains({ origins: [apiOrigin + "/*"] })` and keep the boolean in `chrome.storage` under `apiAccess` for the options page. It SHALL NOT send it. If the call rejects, the stored value SHALL stay unchanged.

#### Scenario: API origin access kept locally, not sent
- **GIVEN** a paired controller with API origin `https://fg.example` whose `permissions.contains` answers `false` for `https://fg.example/*`, then rejects
- **WHEN** the alarm fires twice (`controller.test.ts`)
- **THEN** `permissions.contains` was called with `{ origins: ["https://fg.example/*"] }`, the store holds `apiAccess` `false` after both alarms, and no request body contains `apiAccess`

### Requirement: Background passes the browser permissions to the controller
The background entrypoint SHALL pass the browser's `permissions` to the controller, so both checks run from the existing minute alarm, with no new alarm or listener.

#### Scenario: Background wiring
File: `apps/extension/src/entrypoints/background.test.ts`
- **GIVEN** the background entrypoint run with a fake `browser` whose `permissions.contains` records its arguments and `alarms.onAlarm` captures its listener
- **WHEN** the captured alarm listener fires once
- **THEN** `permissions.contains` was called with `{ origins: ["<all_urls>"] }` and with the API origin pattern, and no alarm or listener was registered beyond the existing ones
