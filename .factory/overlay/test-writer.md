
## Family Guardian rules

- Visible tests live next to the code: `packages/shared/src`, `apps/web/src`, `apps/extension/lib` (fakes in `apps/extension/lib/test-fakes.ts`), `supabase/tests` (PGlite).
- Include the privacy rule (ADR 0005) where a scenario sends or stores data: assert that nothing beyond the allowed fields is sent.
- The tracker credits no time across a gap over 120 s (`MAX_GAP_MS`): time-based tests fire an alarm at least every 2 minutes.
