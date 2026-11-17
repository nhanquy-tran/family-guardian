# Tasks

## 1. Tests first

- [x] 1.1 Write `packages/shared/src/categories.test.ts` with one test per scenario in `specs/domain-categories/spec.md` (category list, seed size/shape/examples/Vietnamese coverage, unknown/empty/IP, normalization, subdomain resolution, multi-part suffix, overrides precedence, import from `index.ts`); verify `npx vitest run packages/shared` fails only because `./categories` does not exist yet

## 2. Implementation

- [x] 2.1 Add `CATEGORIES`, `Category` and `categorize` to `packages/shared/src/categories.ts` per design.md (candidate path via `registrableDomain`, overrides pass then seed pass, `other` fallback, `Object.hasOwn` lookups); verify the categorize/normalization/subdomain/override tests pass
- [x] 2.2 Add `SEED_CATEGORIES` with 140 to 170 entries including the issue's example domains, `dantri.com.vn` and at least 15 Vietnamese sites; verify the seed tests pass
- [x] 2.3 Re-export from `packages/shared/src/index.ts`; verify the package-entry import test passes

## 3. Verify

- [x] 3.1 Run `npm run check` and `npm run build` and fix all failures without weakening tests
