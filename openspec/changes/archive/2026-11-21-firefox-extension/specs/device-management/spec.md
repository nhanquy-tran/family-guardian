## MODIFIED Requirements

### Requirement: Device label
`deviceLabel(device)` SHALL return the trimmed device name when it is not empty, else `"<Browser> on <os>"` where Browser is `Chrome`, `Edge`, `Brave`, `Firefox` or `Other browser`.

#### Scenario: Blank name falls back to default
- **WHEN** `deviceLabel` is called with `{ name: "   ", browser: "brave", os: "Windows" }` (`status.test.ts`)
- **THEN** the result is `"Brave on Windows"`

#### Scenario: Name or default
- **WHEN** `deviceLabel` is called with `{ name: "Lan's laptop", browser: "chrome", os: "Windows" }`, `{ name: null, browser: "edge", os: "Windows" }`, `{ name: null, browser: "firefox", os: "Windows" }` and `{ name: null, browser: "other", os: "Windows" }` (`status.test.ts`)
- **THEN** the results are `"Lan's laptop"`, `"Edge on Windows"`, `"Firefox on Windows"` and `"Other browser on Windows"`

## ADDED Requirements

### Requirement: Devices page shows Firefox
The device list SHALL show the browser of a `firefox` device as "Firefox".

#### Scenario: Firefox device listed
- **GIVEN** a child with one `chrome` and one `firefox` device (`device-list.test.ts`)
- **WHEN** `DeviceList` is rendered
- **THEN** the markup contains both `Chrome` and `Firefox`
