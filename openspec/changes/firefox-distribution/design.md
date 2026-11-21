## Decisions
- **Static files, not routes.** Vercel's filesystem is read-only at runtime, so releases are committed files in `apps/web/public/firefox/` and a merge to `main` deploys them. No route handler, no storage service, no new dependency. A missing `latest.xpi` is a plain 404 from static serving. The `proxy.ts` matcher does not cover `/firefox`, so no login applies; `proxy.ts` is not changed.
- **Update manifest shape.** `{"addons":{"<FIREFOX_ADDON_ID>":{"updates":[{"version","update_link","update_hash":"sha256:<hex>"}]}}}`, versions ascending, `update_link` = `https://family-guardian.co/firefox/family-guardian-<version>.xpi` (built from the version, never from input). The add-on ID is `FIREFOX_ADDON_ID` from `packages/shared/src/extension.ts` (added by #173). The library takes the ID as a parameter; the CLI reads that file directly (it has no imports) and never loads the `@fg/shared` barrel, whose extensionless re-exports Node ESM cannot resolve.
- **Expected version** is `version` in `apps/extension/package.json` (the build version). The script accepts only a version strictly greater than the newest listed one, compared numerically part by part (so `0.10.0` is newer than `0.9.0`; never a string compare), so a rerun or an older file never overwrites a released `.xpi` or rolls `latest.xpi` back.
- **Validation before any write.** Read the `.xpi` as a zip with `node:zlib` (no zip library; the reader walks the central directory and supports stored and deflate entries via `inflateRawSync`): it must contain `manifest.json` with `browser_specific_settings.gecko.id` equal to the ID and `version` equal to the build version, and `META-INF/mozilla.rsa` (AMO-signed; an unsigned file cannot install). Any failure exits non-zero and writes nothing.
- **Write order and rollback.** Versioned `.xpi` first, then `latest.xpi`, then `updates.json` (each via temp file and rename). On any write error the script deletes the new versioned file (if it created it) and restores the previous `latest.xpi` and `updates.json`, so the directory ends byte-for-byte as it started, then exits non-zero. A crash never lists a version whose file is missing.
- **Code layout.** The logic is `apps/extension/lib/firefox-release.ts` (picked up by the existing vitest and coverage `include`): a function taking paths, ID, build version and a write function (so tests inject a failing write at each step). `apps/extension/scripts/firefox-release.ts` is only a thin CLI reading `process.argv`, `package.json` and the ID file. Runner: `"firefox:release": "node scripts/firefox-release.ts"` with root `engines.node` raised to `>=22.18` (type stripping without a flag). All relative imports in these modules use `.ts` extensions. No dependency is added.
- **Header source.** `/firefox/:name(.+\\.xpi)`, unambiguous for `latest.xpi` and versioned files.
- **Binary safety.** `.gitattributes` gets `*.xpi binary`: any rewritten byte breaks `update_hash` and the AMO signature.
- **Test zips.** `firefox-release.test.ts` builds stored (method 0) zips with a small helper in the test file; the reader supports stored and deflate entries.

## Data model
None. No database change; the files are public by design and hold no family data.

## Contracts
Firefox update manifest as above (format fixed by Mozilla). No shared type changes beyond using the #173 constants. Installed extensions are unaffected.

## Failure modes
- Bad, unsigned, wrong-ID, wrong-version or not-newer file: the script fails and writes nothing.
- Filesystem write error at any step: rollback restores the directory exactly; the script exits non-zero. A rerun of the same file then succeeds.
- Before the first release: `updates.json` lists no versions and `latest.xpi` is 404, so Firefox simply finds no update.

## Alternatives
- Route handlers reading files or Supabase Storage: need file tracing or a new store and secrets; static files are simpler.
- Signing in CI: needs AMO keys; ADR 0024 defers it.

## ADR impact
Follows ADR 0024 (hosting under `/firefox/`, manual owner signing) and ADR 0005 (nothing collected). No new or changed ADR. Order against #175 (install `.reg`) matters only to the owner's first release, not to this change.
