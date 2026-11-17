## MODIFIED Requirements

### Requirement: Fail closed when not configured
If `ALERT_CRON_SECRET` is unset or empty the endpoint SHALL respond `500 { "error": "server_error" }` and never accept any token. Mail configuration is not required: the offline endpoint records incidents only (e-mail is sent by the digest, see `digest-emails`).

#### Scenario: Secret not configured
- **GIVEN** the secret is `undefined`, then `""`
- **WHEN** the handler is called with `Bearer ` and with `Bearer undefined`
- **THEN** each response is `500 { error: "server_error" }` and the store is never called

#### Scenario: Mail not configured
- **GIVEN** valid auth, one offline device, and no `RESEND_API_KEY` or `ALERT_FROM_EMAIL`
- **WHEN** the handler is called
- **THEN** the response is `200`, the incident is recorded and no e-mail is attempted

## REMOVED Requirements

### Requirement: Alert e-mail
**Reason**: Replaced by digest e-mails (#58, ADR 0016). The offline endpoint records incidents and never sends e-mail.
**Migration**: See `digest-emails` requirements "Digest delivery" and "Offline endpoint records incidents without e-mail".

### Requirement: E-mail throttle
**Reason**: The digest sends at most one e-mail per family per period, so a per-device throttle no longer exists.
**Migration**: See `digest-emails` requirement "Due period".

### Requirement: Send failures and isolation
**Reason**: No e-mail is sent by the offline endpoint; send failures and claim release are specified for digests.
**Migration**: See `digest-emails` requirement "Digest delivery".
