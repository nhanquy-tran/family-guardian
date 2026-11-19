## Decisions
- Tests only. Actions are tested with `vi.mock` for `next/cache` (spy `revalidatePath`), `next/navigation` (`redirect` throws a marker error carrying the URL, as Next does) and `lib/supabase/server` (`createClient` returns a fake). Lib modules are mocked where that is simpler, except in `children/actions.test.ts`: it uses the real `lib/children` with a fake Supabase client for all its scenarios (success, validation error, store error and no session are produced by the fake client), because `vi.mock` is hoisted per file. Assertions are on arguments and redirect targets, not on lib internals.
- "No session": the session client is RLS-bound, so a signed-out call shows up as a lib failure (`No family for this account`, zero rows changed). This is tested only for the actions whose lib detects it: `addChild`, devices, settings and `removeBlockRule`; tests assert the action redirects to its error URL and never to the success URL. `renameChild`, `deleteChild` and the homework and allowed-hours updates are silent no-ops under RLS (zero rows, `ok: true`), so they are not tested without a session. The proxy redirects signed-out users before any action runs, and changing that behaviour is out of scope (follow-up in NOTES.md).
- `revalidatePath` is called on failure too in the device and settings actions, unlike the children, rules and homework actions.
- Proxy test mocks `@supabase/ssr` `createServerClient` (`auth.getUser` returns a user or null) and `supabaseEnv`, and builds `NextRequest` objects.
- RLS test file `supabase/tests/dashboard-actions-rls.test.ts` reuses `harness.ts` and the seeding approach of `schema.test.ts`; family B's rows are checked unchanged through the service role. Tables written by actions: `children` (name, homework and allowed-hours columns), `block_rules`, `child_category_limits`, `domain_categories`, `devices`, `pairing_codes`, `families`. Some are already covered in other files; this file makes the list complete in one place.
- No scenario asserts coverage numbers: the target is checked by the health report.

## Data model
None.

## Contracts
None. No shared type, device API or extension change.

## Failure modes
Tests only; they cover the existing fail-closed redirects (`?error=`) of each action and the proxy's signed-out redirect.

## Alternatives
A coverage threshold in CI was not chosen: it needs new tooling and was not asked for.

## ADR impact
None.
