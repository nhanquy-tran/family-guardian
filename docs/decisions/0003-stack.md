# 0003. Stack: Next.js, Supabase, Vercel, npm workspaces

Date: 2026-11-17. Status: accepted.

## Decision
- TypeScript everywhere, one repo with npm workspaces: `apps/web`, `apps/extension`, `packages/shared`.
- `apps/web`: Next.js (App Router) + Tailwind, hosted on Vercel.
- Supabase for Postgres, Auth and cron. SQL migrations in `supabase/migrations`.
- Extension built with WXT.
- Tests: Vitest (unit), Playwright (end-to-end).
- E-mail: Resend.

## Why
Well-known, managed, free tiers fit 20 families, and AI agents are very fluent in this stack. npm workspaces avoid installing another package manager.

## Consequences
Vendor lock-in is low: Postgres is standard, Next.js can run elsewhere.
