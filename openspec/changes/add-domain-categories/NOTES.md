# Notes: add-domain-categories (#5)

## What changed
- `packages/shared/src/categories.ts`: `CATEGORIES`, `Category`, `SEED_CATEGORIES` (157 entries, 20+ Vietnamese), `categorize(domain, overrides?)`.
- The `index.ts` re-export was already in place from the test-writer commit.
- Lookup walks from the full host up to the registrable domain (via `registrableDomain`). Overrides are checked first, then the seed, then `other`. Lookups use `Object.hasOwn`.

## Verification
All scenarios are unit tests in `packages/shared/src/categories.test.ts` (unchanged). `npm run check` (60 tests) and `npm run build` pass.

## For the human to check
- Seed categories are subjective (design.md accepts this); skim the lists in `SEED_BY_CATEGORY`.
- The stub `categories.ts` from the test-writer commit was replaced. The tests were not edited.
