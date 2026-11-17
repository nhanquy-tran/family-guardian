# Notes: add-child-device-pairing (#9)

## What changed
- `packages/shared/src/pairing.ts`: alphabet, code generation/normalisation, `PairRequest`/`PairResponse`.
- Migration `20261117200000_device_pairing.sql`: `pair_attempts`, `purge_pair_attempts`, `register_pair_attempt`, `redeem_pairing_code` (service role only), guarded daily `cron.schedule`.
- `lib/children.ts`, `lib/pairing/create-code.ts`, `lib/pairing/pair-device.ts`, `lib/supabase/admin.ts` (`createPairDeps`), `app/api/device/pair/route.ts`.
- `components/children-list.tsx`, `app/dashboard/children/{page.tsx,actions.ts}` (two-step delete via `?confirmDelete=<id>`).
- `docs/architecture.md` updated (flow 2, data model). `lib/device/token.ts` already existed from #10 and was reused.

## Verification
Every scenario is covered by the test-writer's tests (unchanged): shared `pairing.test.ts`, web `children`, `create-code`, `pair-device`, `children-list`, `route` and `admin` tests, and `supabase/tests/pairing.test.ts` on PGlite. `npm run check` (217 tests) and `npm run build` pass.

## For the human to check
- Set `PAIR_RATE_LIMIT_SECRET` in Vercel (task 5.0; the name is already in `.env.example`). I cannot verify Vercel settings.
- Test the migration against the real DB after merge (previews use the production DB, see factory-learnings).
- The route answers `invalid_request` for a non-JSON body, after counting the attempt.
- The active code's expiry is shown as an ISO string ("Valid until ...").
