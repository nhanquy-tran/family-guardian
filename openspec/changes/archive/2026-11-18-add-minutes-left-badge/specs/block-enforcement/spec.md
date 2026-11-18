## MODIFIED Requirements

### Requirement: Manifest grants only what blocking needs
`buildManifest(apiOrigin)` SHALL include permissions `tabs`, `idle`, `storage`, `alarms`, `declarativeNetRequest`, host permissions for the API origin and `<all_urls>`, `blocked.html` as web accessible to `<all_urls>`, `incognito: "not_allowed"`, and an `action` key (`{ default_title: "Family Guardian" }`, needed for the badge and not a permission), and no `declarativeNetRequestFeedback`.

#### Scenario: Manifest contents
- **GIVEN** apiOrigin `https://fg.example`
- **WHEN** `buildManifest` runs (`manifest.test.ts`)
- **THEN** the permissions, host permissions, `web_accessible_resources`, `incognito` and `action` equal the above exactly
