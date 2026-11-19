VERIFY: PASS

Change: cross-browser-limit-usage (#140)

## Completeness
- All tasks in `tasks.md` (1.1, 2.1, 2.2, 3.1, 3.2, 3.3, 4.1) are ticked. NOTES.md lists the docs to update.
- Every requirement in the six delta specs has code and a test (checked by reading both, not by title).

## Correctness
- `device_other_usage` migration (`supabase/migrations/20261119120000_device_other_usage.sql`):
  - Excludes the calling device and sums in the family timezone.
  - The day and the sums share one clock, with a UTC fallback.
  - Limited to 1000 rows by seconds descending; returns one null-domain row when there is no usage.
  - Executable by `service_role` only.
- Store (`apps/web/src/lib/device/supabase-store.ts:9-44`):
  - Maps domains with `categorize` and only the family's override rows, paged with `.range()`.
  - Throws on RPC error and skips null-domain rows.
  - Returns no domains.
- Heartbeat (`apps/web/src/lib/device/heartbeat.ts:131-137`) and rules (`apps/web/src/lib/device/rules-endpoint.ts:67-74`) handlers:
  - Add `otherUsage` only when it passes `OtherUsage.safeParse`.
  - Omit it on a throw or an invalid value, and still return 200.
- `OtherUsage` (`packages/shared/src/contracts.ts:70`) is not part of `HeartbeatResponse` or `RulesResponse`.
- Extension:
  - `sender.ts` parses `otherUsage` separately, after the base parse.
  - The last 200 chunk response supplies the value.
  - The controller stores it before `evaluateLimits`, and `syncRules` stores it too.
  - A missing or invalid value never clears the stored one.
  - `withOtherUsage` ignores a value from a different day and works offline.
  - The badge uses the same helper.
  - `pairWithCode` removes `otherUsage`.
- Tests: `npx vitest run` on `apps/extension/lib`, `apps/web/src/lib/device`, `packages/shared` and the acceptance test: 29 files, 318 tests, all pass.

## Coherence
- No contradiction with the source-of-truth specs or ADRs.
  - Privacy (ADR 0005): only category seconds leave the server, no domains.
  - The re-pair requirement is a MODIFIED delta, as the design says.
  - The new function is service-role only, in line with the device-token security rule.

## WARNING
- I could not run `npm run check` or `npm run build` here: the sandbox denied them. Typecheck, lint and build are not verified by me. Run them before merging.
- I did not run `supabase/tests/cross-browser-usage.test.ts` because it needs a database. I read it: it has all four scenarios (sums, rollover, defaults and caps, permissions). I did not execute it.

## SUGGESTION
- `loadOtherUsage` makes an extra `devices` query plus a paged overrides read on every heartbeat, which runs every minute. This is fine for 20 families. Caching the family id would remove one query if it ever matters.
