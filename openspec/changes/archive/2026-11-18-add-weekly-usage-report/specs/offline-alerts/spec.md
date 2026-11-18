## MODIFIED Requirements

### Requirement: Resend mailer
The mailer SHALL `POST https://api.resend.com/emails` with `Authorization: Bearer <RESEND_API_KEY>`, JSON `{ from, to: [address], subject, text }`, plus `html` only when the message has one. A non-2xx response or a thrown error SHALL be reported as a failed send, not thrown past the handler.

#### Scenario: Request shape
- **GIVEN** a fake `fetch` returning `200`
- **WHEN** the mailer sends a text-only message to `a@x.test` for child "Mia"
- **THEN** `fetch` was called once with that URL, method `POST`, the bearer header, `to: ["a@x.test"]`, subject `Mia: laptop offline` and a `text` field and no `html` field

#### Scenario: Mailer body with html
- **GIVEN** a Resend mailer with a fake fetch
- **WHEN** it sends a message with `text` only, then one with `text` and `html`
- **THEN** the first request body has no `html` key and the second has both `text` and `html`

#### Scenario: Failure is contained
- **GIVEN** a fake `fetch` returning `429`, then one that throws
- **WHEN** the mailer sends
- **THEN** each call resolves to `{ ok: false }`
