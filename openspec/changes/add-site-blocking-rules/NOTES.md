# Notes: add-site-blocking-rules (#14)

## What changed
- Migration `20261117300000_site_blocking.sql`: value check on `block_rules`, unique `(device_id, at, domain)` on `block_events`.
- `@fg/shared`: real `MAX_BLOCKED_ATTEMPTS` (1000) and `MAX_RULE_DOMAINS` (5000), `blocked` on the heartbeat contracts, `RulesResponse` capped, `expandBlockRules`.
- Web: `lib/block-rules.ts`, `BlockRulesView`, rules page and Server Actions, "Block sites" link, `GET /api/device/rules` (`handleRules`, `createRulesStore`), heartbeat stores `blocked` via `insertBlocked`.
- `docs/architecture.md` updated.

## Verification
Every scenario is covered by the tests committed by the test writer (unchanged). `npm run check` (275 tests) and `npm run build` pass.

## For the human to check
- Server Actions (redirect, revalidate) and the page are thin and not unit-tested: try add, duplicate, invalid and remove on `/dashboard/children/<id>/rules`.
- `insertBlocked` uses `upsert(..., { ignoreDuplicates: true })` (supabase-js `insert` has no `onConflict`); it is `on conflict do nothing`.
- Previews share the production database: check migration-dependent behaviour on production after merge.
- The heartbeat `log` `accepted` counts usage rows only; `skipped` includes bad blocked attempts.
