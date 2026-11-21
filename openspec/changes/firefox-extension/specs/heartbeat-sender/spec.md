## MODIFIED Requirements

### Requirement: Browser and OS detection
`detectBrowser({ brands, userAgent, isBrave })`, called by the options page at pairing time, SHALL return `brave` when `isBrave`, else `edge` for the `Microsoft Edge` brand or `Edg/` in the user agent, else `other` for `OPR/`, else `chrome` for the `Google Chrome` brand or `Chrome/`, else `firefox` for `Firefox/` in the user agent, else `other`. `osName` SHALL map `win`, `mac`, `linux`, `cros` to `Windows`, `macOS`, `Linux`, `ChromeOS`, and anything else to `other`.

#### Scenario: Browsers
- **GIVEN** the inputs below (`browser-info.test.ts`)
- **WHEN** `detectBrowser` is called with: `isBrave: true` and Chrome UA; brands `["Microsoft Edge", "Chromium"]`; no brands and UA `... Chrome/130.0 Safari/537.36 Edg/130.0`; no brands and UA `... Chrome/130.0 Safari/537.36 OPR/115.0`; brands `["Google Chrome", "Chromium"]`; no brands and UA `... Chrome/130.0 Safari/537.36`; no brands and UA `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0`; no brands and UA `Mozilla/5.0 (X11) Safari/605.1`
- **THEN** the results are `brave`, `edge`, `edge`, `other`, `chrome`, `chrome`, `firefox`, `other`

#### Scenario: Operating systems
- **GIVEN** `osName`
- **WHEN** it is called with `win`, `mac`, `linux`, `cros`, `android` (`browser-info.test.ts`)
- **THEN** it returns `Windows`, `macOS`, `Linux`, `ChromeOS`, `other`

## ADDED Requirements

### Requirement: Browser name parsing and Firefox heartbeats
`parseBrowserName(value)` in `browser-info.ts` SHALL return the value when it is one of `chrome`, `edge`, `brave`, `firefox`, `other`, and `other` for anything else. The background SHALL use it for the browser name received in a pair message, and heartbeats SHALL send a stored `firefox` as `firefox`.

#### Scenario: Parsing
- **WHEN** `parseBrowserName` is called with `"firefox"`, `"brave"`, `"netscape"`, `undefined` and `42` (`browser-info.test.ts`)
- **THEN** the results are `firefox`, `brave`, `other`, `other`, `other`

#### Scenario: Stored Firefox is sent
- **GIVEN** a paired controller with `browser` `"firefox"` in the store (`controller.test.ts`)
- **WHEN** the alarm fires
- **THEN** the request body contains `browser` `"firefox"`
