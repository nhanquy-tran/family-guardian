## 1. Web (`apps/web/src/app/firefox-public.test.ts`)
- [ ] 1.1 Commit `apps/web/public/firefox/updates.json` with an empty `updates` list
- [ ] 1.2 `headers()` in `apps/web/next.config.ts`: `application/x-xpinstall` for `/firefox/:file*.xpi`

## 2. Release script (`apps/extension/scripts/firefox-release.test.ts`)
- [ ] 2.1 `apps/extension/scripts/firefox-release.ts`: validate, store, update manifest and `latest.xpi`
- [ ] 2.2 Script `firefox:release` in `apps/extension/package.json`

## 3. Docs
- [ ] 3.1 `apps/extension/CLAUDE.md`: Firefox release steps (sign on AMO, run script, commit, merge)
