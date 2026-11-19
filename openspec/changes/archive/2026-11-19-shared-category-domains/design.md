## Decisions
- Signature: `categoryDomains({ categories, overrides?, extraHosts?, exclude?, limit }) → { domains, truncated }`. Candidates = seed keys ∪ override keys ∪ `extraHosts`; keep a host when `categorize(host, overrides)` is in `categories`, it is ≤ 253 chars, matches `^[a-z0-9-]+(\.[a-z0-9-]+)+$` and is not in `exclude`; sort ascending (default code-unit sort); cut to `limit`. `truncated` is true when anything was cut. The overrides map is already merged (family wins over global) by the caller, so "family override wins" is `categorize`'s existing most-specific-override rule.
- Validity is checked before the cap (as the extension does now) so invalid hosts never use up room.
- Server: explicit domain rules (sorted, deduplicated) first, then `categoryDomains` with `exclude` = explicit and `limit = max(0, MAX_RULE_DOMAINS - explicit.length)`; `truncated` is also true if explicit alone exceeds the cap. It expands with the capped override map it returns, so the extension (which stores that map) sees the same overrides.
- Extension: `exclude` = manual domains, `extraHosts` = domains seen today, `limit = max(0, MAX_RULE_DOMAINS - manual.size)`; the result map gets each domain's category from `categorize`.
- `expandBlockRules` keeps its contract and calls the new function with no limit (explicit domains are not validated, as today).
- No direct cross-app parity test (`next build` type-checks tests, see platform notes): both caller tests use the same kind of fixture and compare with `categoryDomains`.

## Data model
None. No tables, columns or stored data.

## Contracts
`RulesResponse` is unchanged. Installed extensions keep working: they receive the same fields; above 5000 domains the server's cut changes from override order to alphabetical, and the extension recomputes its own limit domains from the stored override map, so it needs no server change.

## Failure modes
None new: a pure function with no external call. The rules endpoint still returns 500 on any store failure (existing scenario).

## Alternatives
Make the extension copy the server's order: rejected, it keeps two implementations. Return the full list and let each caller cut: rejected, the cut is the bug.

## ADR impact
Follows ADR 0005 (no new data sent). No new or changed ADR.
