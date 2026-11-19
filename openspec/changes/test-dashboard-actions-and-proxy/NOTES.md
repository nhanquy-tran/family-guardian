# Notes

## Docs to update
None expected.

## Follow-ups (not in this change)
- `renameChild`, `deleteChild` and the homework and allowed-hours updates return `ok: true` when RLS changes zero rows, so a signed-out call redirects to the success URL. The proxy blocks signed-out users first. File a separate bug issue to detect zero rows.
- `proxy` does not catch a thrown `auth.getUser` (for example a network failure): the request errors instead of redirecting. This still fails closed for the dashboard. Record only; no scenario here.
