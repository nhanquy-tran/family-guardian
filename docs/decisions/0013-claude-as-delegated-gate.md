# 0013. Claude as delegated human gate

Date: 2026-11-17. Status: accepted (owner instruction).

## Context
Reviewing every spec and build PR took most of the owner's time. The owner wants to work only on the backlog and let Claude collaborate with the factory.

## Decision
The interactive Claude session takes the spec and build gates on the owner's behalf, as described in `docs/way-of-working.md`: critical review, fix requests, merge when no high/medium findings remain, at most 3 spec fix rounds and 2 build attempts before handing back. Privacy/security ADRs, destructive migrations, new services or secrets, and owner-only tasks are always escalated.

## Consequences
- Moves the factory from Zühlke step 03 (human on the loop) to step 04 (human above the loop) for this project.
- Rule 1 "no agent approves its own work" still holds: the factory agents never merge; the reviewing Claude session is a separate agent from the ones that wrote the code, and every gate decision is recorded as a `Gate (Claude):` PR comment.
- The owner can revert to reviewing PRs at any time.
