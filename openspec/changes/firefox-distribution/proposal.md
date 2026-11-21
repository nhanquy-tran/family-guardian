Depends on: #173
Touches: firefox-distribution, apps/web/next.config.ts

# Serve the signed Firefox add-on and its update manifest

## Why
ADR 0024: Firefox installs our add-on by policy from `https://family-guardian.co/firefox/` and updates it from an update manifest. The owner signs each release on AMO by hand; this change gives that file a home on our domain and a script that publishes it safely.

## What changes
- Static public files under `apps/web/public/firefox/`: `updates.json` (committed with no versions), versioned `.xpi` files and `latest.xpi` (both appear only when the owner runs the release script and commits the result).
- `apps/web/next.config.ts` sends `Content-Type: application/x-xpinstall` for `.xpi` files under `/firefox/`.
- `npm run firefox:release -w extension -- <signed.xpi>`: validates the signed file against the build, stores it as `family-guardian-<version>.xpi`, updates `updates.json` and `latest.xpi`.

## Out of scope
- Signing in CI, AMO API keys, any new secret (ADR 0024: later decision).
- The Windows `.reg` files and install page (#175), privacy policy text.
- Linking `/firefox/*` from any page, sitemap or robots file.
- Removing or hiding old versions.
