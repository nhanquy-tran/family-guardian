VERIFY: CRITICAL

## Verification Report: site-access-alert

| Dimension | Status |
|---|---|
| Completeness | 12/12 tasks ticked; all ADDED/MODIFIED requirements have code and tests |
| Correctness | 1 requirement diverges (Dashboard banner label fallback) |
| Coherence | Design followed; no contradiction with specs found |

### CRITICAL
- **Dashboard banner shows an empty label for a whitespace-only device name.** The offline-alerts spec says `<device>` is the name, else `<child>'s <browser> on <os>`. `apps/web/src/lib/alerts/site-access-banner.ts:22` uses `r.name ?? ...`, which falls back only on null or undefined. A device named `"   "` renders `Blocking is off on    : site access was turned off`.
  - Evidence: `npx vitest run` gives 1 failed and 1041 passed. The failure is `acceptance/site-access-alert/site-access.test.ts:153` ("a blank device name falls back to the browser label").
  - NOTES.md ("Hidden test verdict: code") already named this as a code bug, and it is still unfixed.
  - Fix: `const label = r.name?.trim() || \`${r.children?.name ?? "A child"}'s ${capitalize(r.browser)} on ${r.os}\`;`. Optionally sort on the trimmed name at line 19, using the same trimmed key (`apps/web/src/lib/devices/status.ts:26` already does this).

### WARNING
- NOTES.md says `npm run build` was not run. Definition of done requires it, so run it before the PR.
- NOTES.md "Debugging" says the `design-adoption.test.ts` and `send.test.ts` fixes were made by editing tests (a type fix and a relaxed grep). The assertions' intent is kept, but the owner should confirm this against rule 3 (never weaken tests).

### SUGGESTION
- ADR `docs/decisions/0025-site-access-incidents.md` is still "proposed". The owner must accept it before merge, as NOTES.md says.

### Final assessment
1 critical issue found. Fix before archiving. No checks were skipped. 1 manual owner check (real-browser site-access withholding) is listed in NOTES.md as a manual step.
