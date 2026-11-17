# Tasks

## 0. Prerequisite
- [ ] 0.1 Confirm #38, #10 and #18 are merged (retention builds on their tables and cron pattern)

## 1. Tests first
- [ ] 1.1 Write `supabase/tests/data-retention.test.ts` (purge, roles, apply without pg_cron, failure rollback, child cascade, other-family delete)
- [ ] 1.2 Write `apps/web/src/app/privacy/page.test.tsx`; extend `redirects.test.ts` and the confirmation test in `children-list.test.ts` (block history text); verify they fail only because code is missing

## 2. Implementation
- [ ] 2.1 Add migration `<date -u timestamp>_data_retention.sql` (function, grants, indexes, guarded cron job)
- [ ] 2.2 Add `lib/retention.ts`; rewrite `app/privacy/page.tsx` per spec; add "block history" to the delete confirmation
- [ ] 2.3 Update `docs/architecture.md` and `docs/human-setup.md`

## 3. Verify
- [ ] 3.1 Run `npm run check` and `npm run build`; fix failures without weakening tests
- [ ] 3.2 Note in NOTES.md: check that `cron.job` lists `purge-old-data` on production after merge
