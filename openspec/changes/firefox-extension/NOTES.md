# Notes

## Docs to update
- `docs/platform-notes.md`: new "Firefox" section (manifest version finding and reason, smoke checklist), written by the change itself.
- `docs/architecture.md`: mention the Firefox build target and the `firefox` browser value.
- `apps/extension/CLAUDE.md`: "Chrome, Edge and Brave" becomes "Chrome, Edge, Brave and Firefox"; Firefox build and zip commands.
- `docs/decisions/README.md`: no change (ADR 0024 already indexed).

## Owner steps after merge (not part of this change)
- Verify the manifest-version finding and the smoke checklist on a real Firefox.
- Sign the unlisted add-on on AMO and host `latest.xpi` and `updates.json` (follow-up issues).
