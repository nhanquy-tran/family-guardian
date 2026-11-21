## Test concerns
- `apps/web/src/app/firefox-public.test.ts:94` fails `tsc` (TS2339: Property `source` does not exist on type `never`). `config.matcher` in `proxy.ts` is inferred as `string[]`, so in `typeof m === "string" ? m : m.source` the else branch is `never`. The test needs e.g. `String(m)` or a cast. I did not change `proxy.ts` types to work around it. This fails `npm run check` (typecheck) and `npm run build` (next build type-checks tests). Behaviour is verified: both test files pass under vitest (18 tests).
- The test imports `next/dist/compiled/path-to-regexp`, which has no types. I added a shim, `apps/web/src/path-to-regexp.d.ts`.

## Summary
Added `apps/extension/lib/firefox-release.ts` (zip reader, validation, numeric version order, temp-file writes, rollback). Added the CLI `apps/extension/scripts/firefox-release.ts` (output dir from `FIREFOX_RELEASE_DIR`, default `apps/web/public/firefox`) and the `firefox:release` script. Raised `engines.node` to `>=22.18`. Committed an empty `updates.json`, added the `.xpi` content-type header and `*.xpi binary`, and wrote the release steps in `apps/extension/CLAUDE.md`. The two test files verify every scenario.

## Docs to update
- `apps/extension/CLAUDE.md`: owner release steps (AMO sign, `npm run firefox:release -w extension -- <file>`, commit `apps/web/public/firefox/`, merge).
- `package.json`: root `engines.node` is `>=22.18`.
- `docs/architecture.md`: mention the static `/firefox/` files.

## Debugging
- **`apps/web/src/app/firefox-public.test.ts:94` TS2339 (`source` on `never`)**
  - Root cause: `config.matcher` in `proxy.ts` is `["/dashboard/:path*", "/login"]`, inferred as `string[]`. The `typeof m === "string" ? m : m.source` else branch is `never`.
  - Evidence: `npm run check` failed in the web typecheck with only this error. All 1035 tests already passed under vitest.
  - Verdict: test (an impossible type branch, not a behaviour problem). The code is correct.
  - Change: one line, `const source: string = m;`. The three assertions on `source` are unchanged, so scenario "No login and not listed" is checked as written.
- Result: `npm run check` passes (0 lint errors, 132 files and 1035 tests green).

### Build gate fix round 1
- **What failed:** `npm run check:ci` failed on the coverage gate: `apps/extension/**` branches were 80.85 %, below the 81 % minimum. Untested branches of `firefox-release.ts`: invalid build version, unsupported zip method, corrupt directory or entry, existing versioned file, rollback with no previous `latest.xpi`. CodeQL `js/file-system-race` also flagged the `existsSync` check-then-read.
- **Fix:** added five new tests in `firefox-release.test.ts` (no existing test changed, no threshold lowered). Replaced `existsSync` with a `readOrNull` helper that maps only `ENOENT` to `null` and rethrows other errors; rollback behaviour is unchanged.
- **Result:** `npm run check:ci` passes (1040 tests, extension branches above 81 %) and `npm run build` passes.
