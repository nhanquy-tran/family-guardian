# Tasks

## Extension
- [x] `minutesLeft` in `apps/extension/lib/limits.ts`; tests in `apps/extension/lib/limits.test.ts`
- [x] Controller: optional `badge` dep, `updateBadge` after `handleEvent` and `alarmNormal`, clear in `alarmWhileRejected`; tests in `apps/extension/lib/badge.test.ts` (fake timers, fake badge, no token → no badge call)
- [x] `entrypoints/background.ts`: pass `browser.action` as `badge`
- [x] Manifest gains `action`, permissions unchanged; test in `apps/extension/lib/manifest.test.ts`
