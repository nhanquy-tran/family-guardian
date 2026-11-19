## Decisions
- Both `/api/device/heartbeat` (every minute) and `/api/device/rules` return `otherUsage`, so a limit reached in another browser applies within one heartbeat interval (the extension re-evaluates limits on every alarm). Usage does not bump `rules_version`.
- The SQL function returns per-domain seconds (bounded by distinct domains per day, not raw rows; at most 1000 rows, highest seconds first, because PostgREST caps results at 1000); categorization stays in TypeScript with `categorize`, because the seed list lives in `packages/shared`. The store reads only the family's override rows (paged with `.range()`; the seeds are already in `categorize`), not `listCategoryOverrides` and its 5000 limit. Only category seconds leave the server. The new store method is `otherUsage(deviceId): Promise<OtherUsage | null>`; existing test fakes add `otherUsage: async () => null`.
- "Other devices" means `device_id <> calling device` among the same child's devices; the extension adds its own local seconds, so nothing is counted twice.
- Effective usage = local `limitUsage` + stored `otherUsage.seconds`, only when `otherUsage.day` equals today's `dayKey`; a stale day counts as empty.
- If computing `otherUsage` fails, the heartbeat still returns 200 with `rulesVersion` and omits the field, and `/rules` omits it; the extension keeps the last stored value. A response without it, or with an invalid one, never clears the stored value. Re-pairing removes it (the extension has no unpair; `pairWithCode` is the only reset). This extends #146's "Re-pairing resets rule state" to ten keys, so #146 merges first and this change MODIFIES that requirement.

## Data model
No new table or column. One function `public.device_other_usage(p_device_id uuid)` returning `(day date, domain text, seconds bigint)`, `security invoker`, `set search_path = ''`. It reads the family timezone itself through `devices`, `children` and `families` (fallback `UTC` as `findChild`), computes `day` as `(now() at time zone tz)::date`, and sums today's `usage_minutes` of the child's other devices in that timezone, so the day and the sums share one clock. It returns at most 1000 rows ordered by seconds descending (domains beyond that are dropped, which can only undercount). When there is no usage it returns one row with `domain` null and `seconds` 0, so the day is always known; an unknown device returns no rows. `revoke ... from public, anon, authenticated`; `grant ... to service_role` only (device endpoints use the admin client). No new stored or logged data; retention unchanged.

## Contracts
`OtherUsage = { day: YYYY-MM-DD, seconds: partial record of the 9 categories to int >= 0 }` is exported from `packages/shared` but is **not** a field of `HeartbeatResponse` or `RulesResponse`: those schemas keep parsing as today (zod strips the unknown key), so a bad `otherUsage` can never fail them. Additive: old extensions ignore the field and a new extension works with an old server.

- Server: the handlers add `otherUsage` to the body only if the store result passes `OtherUsage.safeParse`; otherwise they omit it. The `RulesResponse.parse` in the rules handler therefore never sees it.
- Extension: `parseOtherUsage` runs `OtherUsage.safeParse` on the raw body's `otherUsage`, only after the base `HeartbeatResponse` or `RulesResponse` has parsed. Invalid or absent gives `undefined`.
- `FlushResult` `ok` gains `otherUsage?`, taken from the last `200` chunk response of that alarm (`flushQueue` may send several chunks, and halves them on 413). The controller stores it, when present, before `evaluateLimits`. `syncRules` stores the one from the rules response the same way.

Privacy (ADR 0005): category seconds only, no domains.

## Failure modes
Function error, RPC error or invalid store value: field omitted, rest of the response unchanged, extension keeps the last value. Invalid `otherUsage` in a response: ignored by the extension, the stored value kept, and the heartbeat (`rulesVersion`, queue acknowledged) or sync still succeeds, so limits never stop rule updates. Auth failures unchanged (401, nothing read).

## Alternatives
Per-browser limits documented as is: rejected by the owner. Per-domain seconds categorized in the extension: rejected, it sends domains. Categorizing in SQL: rejected, it would duplicate the seed list.

## ADR impact
Follows ADR 0005. No new or changed ADR.
