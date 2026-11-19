Depends on: #140
Touches: domain-categories, site-blocking, limit-enforcement, packages/shared/src/index.ts

## Why
The rules endpoint and the extension (`limitBlockDomains`) each merge seed and overrides, expand categories to domains and cap at `MAX_RULE_DOMAINS`, in different orders (override order on the server, alphabetical in the extension). Above 5000 domains they cut different domains (architecture check #139, finding 3). #140 changes the same files, so it merges first.

## What changes
- New pure function `categoryDomains` in `packages/shared`: categories + overrides (+ extra hosts, exclusions, limit) → alphabetical, validated, capped domain list and a `truncated` flag.
- `rules-endpoint.ts` and `apps/extension/lib/limits.ts` call it; the server expands with the same capped override map it sends to the extension.
- `expandBlockRules` delegates to it (same results).
- No other behaviour change: lists below the cap are identical to today's.

## Out of scope
- Changing `MAX_RULE_DOMAINS`, the response shape, or how overrides are capped in `categoryOverrides`.
- Per-child or per-family caps; a bigger seed.
