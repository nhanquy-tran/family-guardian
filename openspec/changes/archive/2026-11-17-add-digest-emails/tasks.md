# Tasks

## 0. Prerequisite

- [x] 0.1 Confirm #16 is merged and ADR 0016 is approved; if not, stop and report

## 1. Tests first

- [x] 1.1 Write `supabase/tests/digest-emails.test.ts` (PGlite, stubs for `vault` and `net`) and `apps/web/src/lib/digest/schedule.test.ts`
- [x] 1.2 Write `apps/web/src/lib/digest/settings.test.ts`, `content.test.ts`, `send.test.ts` and `apps/web/src/app/api/digest/send/route.test.ts`
- [x] 1.3 Update `apps/web/src/lib/alerts/offline.test.ts`, its store test and route test for "records incidents without e-mail" (remove only the e-mail and throttle scenarios this spec replaces); verify the new tests fail only because code is missing

## 2. Implementation

- [x] 2.1 Add the migration (design 1, 2, 7); verify the database tests pass
- [x] 2.2 Add `lib/digest/schedule.ts`, `content.ts`, `send.ts` (design 3 to 5)
- [x] 2.3 Add `lib/digest/supabase-store.ts` and `app/api/digest/send/route.ts` (POST only)
- [x] 2.4 Change `lib/alerts/offline.ts`, its store and route (design 2)
- [x] 2.5 Add `lib/digest/settings.ts`, `/dashboard/settings`, the timezone capture component and nav link (design 8)
- [x] 2.6 Add `APP_URL` to `apps/web/.env.example` and `docs/human-setup.md`; update flow 6 and the `alerts` and `families` rows in `docs/architecture.md` (architecture.md edits are listed in NOTES.md, not made here)

## 3. Verify

- [ ] 3.1 Run `npm run check` and `npm run build` and fix all failures without weakening tests (build passes; `check` has one failing stale test, see NOTES.md)
- [x] 3.2 Note in the PR that the `send-digests` job and one real digest are checked on production after merge
