
## Family Guardian rules

- Privacy (ADR 0005): the extension sends only registrable domain, seconds, blocked domain, browser, OS and extension version. Never URLs, paths, titles, content, searches, keystrokes or screenshots. More needs an ADR the owner approves; write it as a proposed ADR in `docs/decisions/`.
- RLS on every table, limited to the parent's family; device endpoints use the hashed device token.
- Shared hot files for `Touches`: `packages/shared/src/index.ts`, `apps/web/src/app/dashboard/layout.tsx`, `supabase/migrations`.
- Sensitive capabilities (always risk high): parent-auth, device-pairing, extension-pairing, device-management, activity-tracking, data-retention, privacy-policy, database-schema.
- Time zones, offline devices and several browsers per child: say how each scenario handles them when it counts time or state.
