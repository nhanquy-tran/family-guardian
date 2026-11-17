# Design

## Context

`packages/shared/src/domain.ts` already has `registrableDomain(url)`, which takes a URL and uses a small hard-coded list of multi-part suffixes (`com.vn`, `co.uk`, ...). The extension only ever sends registrable domains (ADR 0005), but the issue asks for categories of specific Google subdomains (`docs.google.com`, `classroom.google.com`), so the seed and the resolver must handle hosts below the registrable domain. Requirements are in `specs/domain-categories/spec.md`.

## Goals / Non-Goals

**Goals:**
- One pure, synchronous, dependency-free function usable in the extension service worker and in Next.js server and client code.

**Non-Goals:**
- No database access, no caching layer, no full Public Suffix List.

## Decisions

1. **File layout.** `packages/shared/src/categories.ts` exports:
   - `CATEGORIES` as a `readonly` tuple (`as const`) and `type Category = (typeof CATEGORIES)[number]`.
   - `SEED_CATEGORIES: Readonly<Record<string, Category>>` (about 150 entries, grouped by category in the source for review).
   - `categorize(domain: string, overrides?: Readonly<Record<string, Category>>): Category`.
   `index.ts` adds `export * from "./categories"`. A plain record (not `Map`) is used so DB rows and JSON can be passed as overrides without conversion. Lookups use `Object.hasOwn` so keys like `constructor` never hit the prototype.
   Alternative: a zod enum for categories. Not needed until a contract carries a category; add it then.

2. **Lookup path.** Normalize input (`trim`, lowercase, strip one trailing `.`). Compute the registrable domain by reusing `registrableDomain` (call it with `https://<host>/`; it returns null for garbage, which maps to `other`). Build candidates from the full host by dropping the leftmost label until the registrable domain is reached. This keeps the suffix rules in one place and guarantees `com.vn` / `co.uk` are never candidates.
   Alternative: refactor `domain.ts` to expose a host-based helper. Rejected to keep this change additive; it can be done later if a second caller needs it.

3. **Precedence.** First pass: overrides over the candidate list, most specific first. Second pass: seed, most specific first. Fallback: `other`. Overrides are the parent's explicit choice, so a parent override on `google.com` beats the seed's `docs.google.com`; a more specific override still beats a broader one. This is the literal reading of the issue ("the override if present, else the seed category").
   Alternative: interleave per level (override then seed at each level). Rejected: a parent setting `google.com` would be silently ignored for Google subdomains in the seed.

4. **Seed content.** Hand-curated, about 150 keys, keys are hosts without `www.`. Includes the issue's examples with these fixed values: `youtube.com` entertainment, `tiktok.com` social, `facebook.com` social, `roblox.com` games, `khanacademy.org` education, `vnexpress.net` news, `zalo.me` communication, `docs.google.com` productivity, `classroom.google.com` education, plus `dantri.com.vn` news. At least 15 Vietnamese sites (`.vn`, `vnexpress.net`, `zalo.me`), e.g. `tuoitre.vn`, `thanhnien.vn`, `shopee.vn`, `tiki.vn`, `hocmai.vn`, `olm.vn`. `google.com` itself is not seeded (search is ambiguous) so it resolves to `other`.

## Risks / Trade-offs

- [Seed categories are subjective, e.g. YouTube used for homework] → Accepted by ADR 0005; parents fix it with overrides in a later change.
- [Small suffix list misses some multi-part TLDs] → Same limitation as existing `registrableDomain`; worst case a lookup returns `other`.
- [Override keys must be lowercase] → Documented in the JSDoc; DB values are written lowercase by the future override UI.
