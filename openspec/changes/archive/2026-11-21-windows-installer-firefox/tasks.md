## 1. Tests first
- [x] 1.1 `packages/shared/src/extension.test.ts`: `FIREFOX_INSTALL_URL` value
- [x] 1.2 `apps/web/src/lib/installer/reg.test.ts`: Firefox setup and remove scenarios, escaping, unchanged Chromium prefix, re-run, counts and full texts
- [x] 1.3 `apps/web/src/components/install-instructions.test.ts`: Firefox steps and retained scenarios
- [x] 1.4 `apps/web/src/components/site/setup-guide.test.tsx`: Firefox in the restart and pair steps, words check

## 2. Shared
- [x] 2.1 `packages/shared/src/extension.ts`: add `FIREFOX_INSTALL_URL`

## 3. Web
- [x] 3.1 `apps/web/src/lib/installer/reg.ts`: `regString`, Firefox block in setup and remove
- [x] 3.2 `apps/web/src/components/install-instructions.tsx`: Firefox steps
- [x] 3.3 `apps/web/src/messages/{en,vi,zh}.json`: setup `restart` and `pair` steps mention Firefox

## 4. Docs
- [x] 4.1 See NOTES.md
