## Summary
- New migration `20261121110000_offline_covered_by_sibling.sql` replaces `find_offline_devices` (skips devices covered by a sibling seen later and within 15 min) and `resolve_offline_alerts` (also resolves when such a sibling exists), attributes and grants restated.
- `banner.ts` selects `resolved_at` and hides resolved alerts.
- Verified by the scenarios in `supabase/tests/offline-alerts.test.ts`, `supabase/tests/digest-emails.test.ts` and `apps/web/src/lib/alerts/banner.test.ts` (all passing).

## Docs to update
- `docs/platform-notes.md`: Firefox checklist step 3 ("known, see #179") is fixed; add the sibling rule next to the #18 note.
- `docs/platform-notes.md`: next to the #18 note, record that a removed or disabled extension in one browser looks like a closed browser while another browser of the child reports; offline alerts do not detect per-browser tampering, force-install by policy (ADR 0002, 0024) is the control.
