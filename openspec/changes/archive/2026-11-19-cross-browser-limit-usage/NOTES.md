Docs to update:
- `docs/architecture.md`: the `children` line also lists `child_category_limits` among the tables that bump `rules_version`; the rules and heartbeat contract text mentions `otherUsage`; the extension storage list adds `otherUsage`.
- `docs/platform-notes.md`: `device_other_usage` returns at most 1000 rows by seconds descending.

## Summary
- Migration `20261119120000_device_other_usage.sql`: SQL function summing today's per-domain seconds of the child's other devices in the family timezone (service role only). Verified by `supabase/tests/cross-browser-usage.test.ts`.
- `packages/shared`: `OtherUsage` schema, separate from `HeartbeatResponse` and `RulesResponse` (`contracts.test.ts`).
- Web: `loadOtherUsage` in `supabase-store.ts` (RPC, family override rows paged with `.range()`, `categorize`); heartbeat and rules handlers add `otherUsage` only when it parses and omit it on error (`heartbeat.test.ts`, `rules-endpoint.test.ts`, `supabase-store.test.ts`). `RulesStore.findChild` now also returns `deviceId` (needed to call the function).
- Extension: `parseOtherUsage` and `withOtherUsage` in `limits.ts`; `FlushResult` `ok` carries `otherUsage?`; the controller and `syncRules` store it and add it to local usage for limit evaluation and the badge; `pairWithCode` removes it (`sender`, `controller`, `rules`, `badge`, `pairing` tests).
