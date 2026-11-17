# Family Guardian: agent instructions

Parental monitoring for kids' Windows laptops: a Chrome/Edge/Brave extension plus a Next.js dashboard. MVP for 20 families.

Read before any change: `docs/architecture.md`, `docs/decisions/` (ADRs), and the OpenSpec change you are working on in `openspec/changes/`.

## Repo layout

- `apps/web`: Next.js App Router + Tailwind, deployed on Vercel. Parent dashboard and device API (`src/app/api/device/*`).
- `apps/extension`: WXT, Manifest V3. Entrypoints in `entrypoints/`, logic in `lib/` (unit-tested).
- `packages/shared`: zod API contracts, domain helpers, focus score. Shared by web and extension.
- `supabase/migrations`: SQL migrations, including RLS policies. Never edit an applied migration; add a new one.
- `openspec/`: specs and change proposals. `docs/`: architecture, roadmap, plan, factory, ADRs.

## Commands

- `npm install` at the root (npm workspaces; do not use pnpm or yarn)
- `npm run check`: typecheck + lint + unit tests. Must pass before you finish.
- `npm run build`: builds shared, web and extension
- `npm run dev:web`, `npm run dev:ext`

## Rules

1. **Privacy (ADR 0005)**: the extension may only send registrable domain, seconds, blocked domain, browser and OS name. Never URLs, paths, titles, page content, search terms, keystrokes or screenshots. Any change that would collect more needs a new ADR approved by the human.
2. **Security**: every Supabase table has RLS limited to the parent's family. Device endpoints authenticate with a hashed device token. Never commit secrets; use `.env.example` for names only.
3. **Test-first**: write or update tests for each spec scenario before the implementation. Do not delete or weaken tests written by the test-writer agent; if one is wrong, say so in the PR.
4. **Small PRs**: one OpenSpec change per PR, title `<type>: <summary> (#<issue>)`, body says `Closes #<issue>` and lists how each scenario is verified.
5. **Simplicity**: no new service, library or infrastructure without a reason in the PR; anything structural needs an ADR in `docs/decisions/`.
6. **Next.js**: this Next.js version may differ from your training data. Check `node_modules/next/dist/docs/` before using an API you are unsure of.
7. Comments only for complex code. TypeScript strict, no `any`.

## Definition of done

- All spec scenarios covered by tests, `npm run check` and `npm run build` pass
- Docs updated if behaviour or architecture changed
- PR links the issue and the OpenSpec change
