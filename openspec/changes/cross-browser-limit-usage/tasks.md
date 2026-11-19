## 1. Database
- [ ] 1.1 Migration `device_other_usage` (timestamp at build time); tests in `supabase/tests/cross-browser-usage.test.ts`

## 2. Shared and web
- [ ] 2.1 `OtherUsage` schema, optional on `HeartbeatResponse` and `RulesResponse` (`packages/shared/src/contracts.test.ts`)
- [ ] 2.2 `otherUsage` store method (RPC plus `categorize`); heartbeat and rules handlers return it and omit it on error (`apps/web/src/lib/device/*.test.ts`)

## 3. Extension
- [ ] 3.1 Store `otherUsage` from heartbeat and rules responses; clear on unpair (`controller.test.ts`, `pairing.test.ts`)
- [ ] 3.2 Add it to local usage in limit evaluation and the badge (`controller.test.ts`, `rules.test.ts`, `badge.test.ts`)

## 4. Docs
- [ ] 4.1 NOTES.md lists the docs to update
