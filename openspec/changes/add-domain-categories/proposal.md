# Proposal

Implements GitHub issue #5 ("Shared: domain categories and categorize(domain)").

## Why

The dashboard (categories view), category block rules and the focus score all need to know which category a domain belongs to. Today `packages/shared` has no category list and no way to map a domain to a category, so each consumer would invent its own.

## What Changes

- Add `packages/shared/src/categories.ts`, exported from `@fg/shared`:
  - The fixed list of 9 categories: `education`, `entertainment`, `social`, `games`, `news`, `shopping`, `communication`, `productivity`, `other`, plus a `Category` type.
  - A seed map of about 150 popular family domains (global and Vietnamese), e.g. `youtube.com`, `tiktok.com`, `facebook.com`, `roblox.com`, `khanacademy.org`, `vnexpress.net`, `zalo.me`, `docs.google.com`, `classroom.google.com`.
  - `categorize(domain, overrides?)`: returns the override category if one matches, else the seed category, else `other`.
  - Subdomains resolve by walking up to the registrable domain, so an explicitly listed host (`docs.google.com`) keeps its own category and `www.youtube.com` falls back to `youtube.com`.
- Unit tests in `packages/shared/src/categories.test.ts`.

Pure function and constant data; no network, storage or schema changes. Input is a domain only, which fits ADR 0005.

## Capabilities

### New Capabilities

- `domain-categories`: the category list, the seed domain map and the rules for resolving a domain to a category (overrides, seed, subdomain fallback, default `other`).

### Modified Capabilities

None.

## Impact

- New file `packages/shared/src/categories.ts` and its test; `packages/shared/src/index.ts` re-exports it.
- No new dependencies. Reuses the existing `registrableDomain` logic in `packages/shared/src/domain.ts`.
- Web and extension can import it; no consumer is wired up in this change.

## Out of scope

- Seeding the `domain_categories` Supabase table or any migration.
- Loading family overrides from the database, or any UI to edit overrides.
- Using categories in the dashboard, block rules (`kind: 'category'`) or the focus score.
- Telling homework vs. entertainment use of the same domain apart (ADR 0005).
- A complete Public Suffix List; the existing small suffix list in `domain.ts` is kept as is.
