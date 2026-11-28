
## Family Guardian rules

- Privacy (ADR 0005): nothing beyond registrable domain, seconds, blocked domain, browser, OS and extension version leaves the extension. A leak is high.
- RLS on every table limited to the parent's family, hashed device tokens on every device route, no secrets. A gap is high.
- A blocking, limit, pairing or other protection that can stay off after a failure is high; installed extensions must keep working (backward-compatible contract).
