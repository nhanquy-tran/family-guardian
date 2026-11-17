# Family Guardian: agent instructions

Parental monitoring for kids' Windows laptops: a Chrome/Edge/Brave extension plus a Next.js dashboard. MVP for 20 families.

## Where things are (read what your task needs)

| What | Where |
|---|---|
| Current behaviour (source of truth) | `openspec/specs/<capability>/spec.md` |
| Work in progress | `openspec/changes/<name>/` (proposal, design, tasks, delta specs, NOTES) |
| Platform facts that caused bugs before | `docs/platform-notes.md` (always read) |
| Decisions | `docs/decisions/README.md` (one line per ADR; open an ADR only if it applies) |
| Architecture overview | `docs/architecture.md` |
| Area rules | `apps/web/CLAUDE.md`, `apps/extension/CLAUDE.md`, `supabase/CLAUDE.md`, `packages/shared/CLAUDE.md` |
| Procedures | skills in `.claude/skills/` (`add-migration`, `add-device-route`, OpenSpec skills) |

## Commands

- `npm install` at the root (npm workspaces only)
- `npm run check`: typecheck + lint + unit tests. Must pass before you finish.
- `npm run build`: builds shared, web and extension
- `npx vitest run <file>`: run one test file

## Rules

1. **Privacy (ADR 0005)**: the extension sends only registrable domain, seconds, blocked domain, browser, OS and extension version. Never URLs, paths, titles, content, searches, keystrokes or screenshots. More needs an ADR approved by the owner.
2. **Security**: RLS on every table, limited to the parent's family. Device endpoints use a hashed device token. Never commit secrets; `.env.example` holds names only.
3. **Test-first**: tests for each scenario come before the implementation. Never delete or weaken tests written by the test writer.
4. **One change per PR**: title `<type>: <summary> (#<issue>)`, body `Closes #<issue>`.
5. **Simplicity**: no new service, library or infrastructure without a reason; structural choices need an ADR.
6. TypeScript strict, no `any`. Comments only for complex code.

## Definition of done

All scenarios tested, `npm run check` and `npm run build` pass, tasks ticked, NOTES.md lists docs to update.
