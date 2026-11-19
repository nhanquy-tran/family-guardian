## Decisions
- Tests only. Actions are tested with `vi.mock` for `next/cache` (spy `revalidatePath`), `next/navigation` (`redirect` throws a marker error carrying the URL, as Next does) and `lib/supabase/server` (`createClient` returns a fake). Lib modules are mocked where that is simpler; assertions are on arguments and redirect targets, not on lib internals.
- "No session": the session client is RLS-bound, so a signed-out call shows up as a lib failure (`No family for this account`, zero rows changed). Tests assert the action redirects to its error URL and never to the success URL.
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
