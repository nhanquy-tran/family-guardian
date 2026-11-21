## Decisions
- **Static files, not routes.** Vercel's filesystem is read-only at runtime, so releases are committed files in `apps/web/public/firefox/` and a merge to `main` deploys them. No route handler, no storage service, no new dependency. A missing `latest.xpi` is a plain 404 from static serving. The `proxy.ts` matcher does not cover `/firefox`, so no login applies; `proxy.ts` is not changed.
- **Update manifest shape.** `{"addons":{"<FIREFOX_ADDON_ID>":{"updates":[{"version","update_link","update_hash":"sha256:<hex>"}]}}}`, versions ascending, `update_link` = `https://family-guardian.co/firefox/family-guardian-<version>.xpi` (built from the version, never from input). The add-on ID comes from `@fg/shared` (`FIREFOX_ADDON_ID`, added by #173).
- **Expected version** is `version` in `apps/extension/package.json` (the build version). The script accepts only a version strictly greater than the newest listed one, so a rerun or an older file never overwrites a released `.xpi` or rolls `latest.xpi` back.
- **Validation before any write.** Read the `.xpi` as a zip with `node:zlib` (no zip library): it must contain `manifest.json` with `browser_specific_settings.gecko.id` equal to the ID and `version` equal to the build version, and `META-INF/mozilla.rsa` (AMO-signed; an unsigned file cannot install). Any failure exits non-zero and writes nothing.
- **Write order.** Versioned `.xpi` first, then `latest.xpi`, then `updates.json` (each via temp file and rename), so a crash never lists a version whose file is missing.
- The script logic is a pure function taking paths, ID, build version and a write function (testable with temp directories and an injected failing write); the CLI wrapper only reads `process.argv` and `package.json`. Run it with Node 22 type stripping or the repo's existing runner; add no dependency.

## Data model
None. No database change; the files are public by design and hold no family data.

## Contracts
Firefox update manifest as above (format fixed by Mozilla). No shared type changes beyond using the #173 constants. Installed extensions are unaffected.

## Failure modes
- Bad, unsigned, wrong-ID, wrong-version or not-newer file: the script fails and writes nothing.
- Filesystem write error: temp-then-rename keeps the previous files intact; the script exits non-zero.
- Before the first release: `updates.json` lists no versions and `latest.xpi` is 404, so Firefox simply finds no update.

## Alternatives
- Route handlers reading files or Supabase Storage: need file tracing or a new store and secrets; static files are simpler.
- Signing in CI: needs AMO keys; ADR 0024 defers it.

## ADR impact
Follows ADR 0024 (hosting under `/firefox/`, manual owner signing) and ADR 0005 (nothing collected). No new or changed ADR. Order against #175 (install `.reg`) matters only to the owner's first release, not to this change.
