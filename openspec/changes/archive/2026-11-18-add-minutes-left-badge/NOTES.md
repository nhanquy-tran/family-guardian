# Notes

## Summary
- `minutesLeft` in `lib/limits.ts`; controller `updateBadge` after every `handleEvent` and `alarmNormal`, cleared in `alarmWhileRejected`; failures caught and logged; `badge: browser.action` wired in `background.ts`; manifest gains `action`.
- Verified by `limits.test.ts`, `badge.test.ts`, `manifest.test.ts`.

## Docs to update
- `docs/chrome-web-store.md`: note the `action` manifest key (no new permission) and the badge.
- `docs/architecture.md`: extension shows the minutes-left badge from local limit usage.
