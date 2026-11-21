## MODIFIED Requirements

### Requirement: Value constraints
`devices.browser` SHALL be one of `chrome`, `edge`, `brave`, `firefox`, `other`. `block_rules.kind` SHALL be `domain` or `category`. `pairing_codes.code` SHALL be 6 characters `A-Z0-9`. `children.homework_categories` and `domain_categories.category` SHALL only contain `education`, `entertainment`, `social`, `games`, `news`, `shopping`, `communication`, `productivity`, `other`. `alerts.kind` SHALL be `offline`. The migration that added `firefox` SHALL NOT update, delete or re-grant anything.

#### Scenario: Invalid enum values rejected
- **WHEN** the service role inserts a device with browser `netscape`, a block rule with kind `url`, a pairing code `abc123`, a child with homework category `homework`, a domain category `music`, and an alert with kind `other` (`schema.test.ts`)
- **THEN** each insert fails with a check violation

#### Scenario: Valid values accepted
- **WHEN** the service role inserts a device with browser `edge`, a device with browser `firefox`, a block rule with kind `category` and value `games`, a pairing code `AB12CD`, a child with homework categories `{education,productivity}` and an alert with kind `offline` (`schema.test.ts`)
- **THEN** each insert succeeds

#### Scenario: Firefox migration only changes the check
- **WHEN** `schema.test.ts` reads the `firefox` migration file in `supabase/migrations`
- **THEN** it contains no `update`, `delete`, `truncate`, `grant` or `revoke` statement
- **AND** it changes the `devices.browser` check
