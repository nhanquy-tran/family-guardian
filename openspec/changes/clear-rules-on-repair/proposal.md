Depends on: none
Touches: block-enforcement, extension-pairing

# Clear the previous child's block rules when pairing again

## Why
Re-pairing (for example to a different child) leaves `rulesDomains` and every dynamic `declarativeNetRequest` rule in place. Until the first rules sync succeeds, the previous child's manual blocks stay active and limit evaluation reads the stale domains. If that sync fails, they stay longer (#139, finding 4).

## What changes
- A successful `pairWithCode` also removes `rulesDomains` and every dynamic DNR rule (manual blocks, limit blocks, the allowed-hours rule) before the new token is stored.
- `pairWithCode` receives the `dnr` object from the controller.
- If clearing the rules fails, pairing fails and nothing is changed.

## Out of scope
- New permissions (`declarativeNetRequest` is already granted).
- Cancelling the allowed-hours alarm (the next `reconcileHours` finds no hours and does nothing).
- Any server or database change.
