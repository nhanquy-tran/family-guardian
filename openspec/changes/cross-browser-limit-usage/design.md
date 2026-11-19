## Decisions
- Both `/api/device/heartbeat` (every minute) and `/api/device/rules` return `otherUsage`, so a limit reached in another browser applies within one heartbeat interval (the extension re-evaluates limits on every alarm). Usage does not bump `rules_version`.
- The SQL function returns per-domain seconds (bounded by distinct domains per day, not raw rows); categorization stays in TypeScript with `categorize` and the merged overrides, because the seed list lives in `packages/shared`. Only category seconds leave the server. The new store method is `otherUsage(deviceId): Promise<OtherUsage | null>`; existing test fakes add `otherUsage: async () => null`.
- "Other devices" means `device_id <> calling device` among the same child's devices; the extension adds its own local seconds, so nothing is counted twice.
- Effective usage = local `limitUsage` + stored `otherUsage.seconds`, only when `otherUsage.day` equals today's `dayKey`; a stale day counts as empty.
- If computing `otherUsage` fails, the heartbeat still returns 200 with `rulesVersion` and omits the field, and `/rules` omits it; the extension keeps the last stored value. A response without it never clears the stored value. Unpairing clears it.

## Data model
No new table or column. One function `public.device_other_usage(p_device_id uuid, p_tz text)` returning `(domain text, seconds bigint)`, `security invoker`, `set search_path = ''`, executable by `service_role` only (device endpoints use the admin client). Reads `usage_minutes` joined to `devices`; an invalid timezone raises `invalid_timezone`. No new stored or logged data; retention unchanged.

## Contracts
`OtherUsage = { day: YYYY-MM-DD, seconds: partial record of the 9 categories to int >= 0 }`, optional on both responses. Additive: installed extensions ignore the field (zod strips unknown keys) and a new extension works with an old server. Privacy (ADR 0005): category seconds only, no domains.

## Failure modes
Function error or invalid timezone: field omitted, rest of the response unchanged, extension keeps the last value. Auth failures unchanged (401, nothing read). A malformed `otherUsage` fails the response parse like any malformed body.

## Alternatives
Per-browser limits documented as is: rejected by the owner. Per-domain seconds categorized in the extension: rejected, it sends domains. Categorizing in SQL: rejected, it would duplicate the seed list.

## ADR impact
Follows ADR 0005. No new or changed ADR.
