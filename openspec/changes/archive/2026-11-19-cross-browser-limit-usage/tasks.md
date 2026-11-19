## 1. Database
- [x] 1.1 Migration `device_other_usage` (timestamp at build time); tests in `supabase/tests/cross-browser-usage.test.ts`

## 2. Shared and web
- [x] 2.1 `OtherUsage` schema, separate from `HeartbeatResponse` and `RulesResponse` (`packages/shared/src/contracts.test.ts`)
- [x] 2.2 `otherUsage` store method (RPC plus `categorize`, family override rows only); heartbeat and rules handlers validate it, return it, and omit it on error or when invalid (`apps/web/src/lib/device/*.test.ts`)

## 3. Extension
- [x] 3.1 `FlushResult` `ok` carries `otherUsage?` from the last `200` chunk; separate `safeParse`; store it before `evaluateLimits` and on sync (`sender.test.ts`, `controller.test.ts`, `rules.test.ts`)
- [x] 3.2 Add it to local usage in limit evaluation and the badge (`controller.test.ts`, `rules.test.ts`, `badge.test.ts`)
- [x] 3.3 Add `otherUsage` to the keys `pairWithCode` removes (`pairing.test.ts`; #146 is merged)

## 4. Docs
- [x] 4.1 NOTES.md lists the docs to update
