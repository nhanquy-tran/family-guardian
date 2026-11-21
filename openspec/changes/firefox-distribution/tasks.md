## 1. Web (`apps/web/src/app/firefox-public.test.ts`)
- [x] 1.1 Commit `apps/web/public/firefox/updates.json` with an empty `updates` list
- [x] 1.2 `headers()` in `apps/web/next.config.ts`: `application/x-xpinstall` for `/firefox/:name(.+\\.xpi)`
- [x] 1.3 `.gitattributes`: add `*.xpi binary`

## 2. Release script (`apps/extension/lib/firefox-release.test.ts`)
- [x] 2.1 `apps/extension/lib/firefox-release.ts`: validate (numeric version compare, zip reader), store, update manifest and `latest.xpi`, roll back on write error
- [x] 2.2 `apps/extension/scripts/firefox-release.ts`: thin CLI; reads the ID from `packages/shared/src/extension.ts`, not the `@fg/shared` barrel; `.ts` import extensions
- [x] 2.3 Script `"firefox:release": "node scripts/firefox-release.ts"` in `apps/extension/package.json`; root `package.json` `engines.node` to `>=22.18`

## 3. Docs
- [x] 3.1 `apps/extension/CLAUDE.md`: Firefox release steps (sign on AMO, run script, commit, merge)
