# Notes

## Docs to update
- `docs/platform-notes.md`: new "Firefox" section (manifest version finding and reason, smoke checklist with a real block test), written by the change itself.
- `docs/architecture.md`: mention the Firefox build target and the `firefox` browser value.
- `apps/extension/CLAUDE.md`: "Chrome, Edge and Brave" becomes "Chrome, Edge, Brave and Firefox"; Firefox build and zip commands.
- `docs/decisions/README.md`: no change (ADR 0024 already indexed).

## Expected test edits
`firefox` was the invalid browser in existing tests; it is valid now, so `heartbeat.test.ts`, `pair-device.test.ts` and `supabase/tests/schema.test.ts` switch the invalid value to `netscape`. These edits match the MODIFIED requirements in this change.

## Owner steps after merge (not part of this change)
- Verify the manifest-version finding and the smoke checklist on a real Firefox.
- Sign the unlisted add-on on AMO and host `latest.xpi` and `updates.json` (follow-up issues).
- Follow-up #176: lost-site-access heartbeat value (ADR 0024 fallback if MV2 turns out revocable).
- Follow-up #179: offline alerts with several browsers per child; must land before the Firefox `.reg` (#175, which depends on #179).
