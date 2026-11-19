# Notes

Docs to update:
- `e2e/README.md`: add a "Write flows" section (stage `onboarded`, Noah, pairing token, 3 pair calls per project, per-run `x-forwarded-for` `192.0.2.<n>` for the rate limit, `PAIR_RATE_LIMIT_SECRET` set for the e2e web server). Add: before running locally, stop any running web server or export `PAIR_RATE_LIMIT_SECRET` (`reuseExistingServer` reuses a server started without it, and pairing then fails with 500).
- `docs/architecture.md`: only if it lists the e2e suite contents.
