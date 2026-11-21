VERIFY: PASS

## Completeness
- All tasks in tasks.md are ticked (1.1–4.1); NOTES.md lists docs to update and owner steps.
- Every requirement in the delta specs has code and tests: Firefox policy value (`packages/shared/src/extension.ts:6`, `apps/web/src/lib/installer/reg.ts:23-26,42-51`), setup/remove Firefox blocks, re-run safety (Chromium text unchanged), install page Firefox steps (`install-instructions.tsx`), setup guide restart/pair steps in en/vi/zh.
- Related tests run and pass: 35 files, 224 tests (reg, install-instructions, setup-guide, extension, acceptance firefox-policy).

## Correctness
- `reg.ts` emits the Firefox key after the three Chromium sections with `ExtensionSettings`, `DisablePrivateBrowsing` and `DisableSafeMode` in that order. Remove uses `=-` for each. `regString` escapes backslashes first, then quotes. No key deletion.
- Install page: Firefox steps sit after the setup link and before the remove link. The text has "new code", "same child", "empty", "guest", "whole" and "not only".
- Messages mention Firefox in `restart` and `pair` for all three locales, with matching keys.

## Coherence
- No contradiction with ADR 0005 (no new data sent) or with the existing specs. MODIFIED/ADDED deltas are used correctly.

## WARNING
- None.

## SUGGESTION
- `vitest.config.ts:22` raises the web lib branch threshold from 81 to 82. This is outside the spec, but harmless.
- Owner step: publish the first signed Firefox release (`latest.xpi`) before or with the deploy (see NOTES.md). The forced install fails until then.
