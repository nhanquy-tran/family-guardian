## 1. Tests first
- [ ] 1.1 `supabase/tests/offline-alerts.test.ts`: sibling detection scenarios (Chrome and Firefox of one child, single device)
- [ ] 1.2 `supabase/tests/digest-emails.test.ts`: sibling resolution scenarios
- [ ] 1.3 `supabase/tests/digest-emails.test.ts`: silent sibling does not resolve; find, claim, resolve in one run (both stay open); function attributes and access
- [ ] 1.4 `apps/web/src/lib/alerts/banner.test.ts`: resolved alerts hidden

## 2. Database
- [ ] 2.1 New migration replacing `find_offline_devices` and `resolve_offline_alerts` (follow the `add-migration` skill), restating `stable`/invoker, `security definer`, `set search_path = ''` and grants

## 3. Web
- [ ] 3.1 `apps/web/src/lib/alerts/banner.ts`: select `resolved_at` and filter on it

## 4. Docs
- [ ] 4.1 `docs/platform-notes.md`: sibling rule and tamper trade-off next to the #18 note
