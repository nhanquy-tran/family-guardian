## Decisions

- **Module** `lib/category-overrides.ts` takes a `SupabaseClient` (session client, RLS) like `lib/block-rules.ts`. Result codes: `invalid_domain`, `invalid_category`, `not_found`, `failed`.
- **Save = upsert** on `(family_id, domain)`, so "add or change" is one action. The family id is read from `parents` (RLS limits it to the parent's own row); if it cannot be read, the result is `failed` and nothing is written.
- **Remove** deletes by id; RLS limits it to the family's rows, so a global row or another family's row deletes zero rows and returns `not_found`.
- **List** returns the family's rows only (`family_id` not null), sorted by domain. A query error returns a failed result, never an empty list.
- **rules_version**: bumped by the existing trigger `domain_categories_bump_rules_version` (insert, update, delete; family rows only). Saving an unchanged category still bumps (harmless).
- **Page** `app/dashboard/categories/page.tsx` stays thin: renders `CategoryOverridesView` with server actions in `actions.ts` (redirect with `?error=<code>`, like the rules page). `?domain=` pre-fills the domain input; it is normalised and ignored if invalid.
- **Usage link** is a plain `<a href>` (works without JavaScript, per platform notes) with the domain URL-encoded.
- **Style**: `ui.ts` classes only; form rows wrap and the list is a card with no fixed widths, so 375 px works.

## Risks

- Previews share the production database; no new migration is needed, so previews behave like production.
