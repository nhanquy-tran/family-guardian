Docs to update:
- `docs/architecture.md`: the `children` line also lists `child_category_limits` among the tables that bump `rules_version`; the rules and heartbeat contract text mentions `otherUsage`; the extension storage list adds `otherUsage`.
- `docs/platform-notes.md`: `device_other_usage` returns at most 1000 rows by seconds descending.

## Summary
- Migration `20261119042000_device_other_usage.sql`: `device_other_usage(p_device_id)` (invoker, service_role only). Verified by `supabase/tests/cross-browser-usage.test.ts`.
- `OtherUsage` schema in `packages/shared` (not part of the response schemas). Verified by `other-usage.test.ts`.
- Web: store `otherUsage` (RPC, family override rows paged, `categorize`), heartbeat and rules handlers add it only when valid and omit it on error. Verified by `other-usage-store`, `heartbeat-other-usage`, `rules-other-usage` tests.
- Extension: `parseOtherUsage` and `withOtherUsage` in `limits.ts`; sender returns it from the last 200 chunk; controller and `syncRules` store it before evaluating limits; the badge and limit evaluation add it for today's day only; `pairWithCode` removes it. Verified by `lib/other-usage.test.ts`.

## Deviations from the design
- `otherUsage` stays optional on `HeartbeatStore` and `RulesStore` (as in the test writer's stub), because the existing fakes in `heartbeat.test.ts` and `rules-endpoint.test.ts` lack it and tests cannot be edited by the developer. Making it required needs `otherUsage: async () => null` added to those two fakes.
- `findChild` returns `deviceId` (optional in the type, as in the stub); the real store always sets it.
