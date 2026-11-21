## 1. Tests first
- [ ] 1.1 `packages/shared/src/extension.test.ts`: `FIREFOX_INSTALL_URL` value
- [ ] 1.2 `apps/web/src/lib/installer/reg.test.ts`: Firefox setup and remove scenarios, escaping, unchanged Chromium prefix, re-run, counts and full texts
- [ ] 1.3 `apps/web/src/components/install-instructions.test.ts`: Firefox steps and retained scenarios
- [ ] 1.4 `apps/web/src/components/site/setup-guide.test.tsx`: Firefox in the restart and pair steps, words check

## 2. Shared
- [ ] 2.1 `packages/shared/src/extension.ts`: add `FIREFOX_INSTALL_URL`

## 3. Web
- [ ] 3.1 `apps/web/src/lib/installer/reg.ts`: `regString`, Firefox block in setup and remove
- [ ] 3.2 `apps/web/src/components/install-instructions.tsx`: Firefox steps
- [ ] 3.3 `apps/web/src/messages/{en,vi,zh}.json`: setup `restart` and `pair` steps mention Firefox

## 4. Docs
- [ ] 4.1 See NOTES.md
