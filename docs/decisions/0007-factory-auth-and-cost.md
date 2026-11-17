# 0007. Factory authentication and cost control

Date: 2026-11-17. Status: accepted.

## Decision
- The factory uses an Anthropic Console API key stored as the repo secret `CLAUDE_API_KEY`, not a personal subscription token, so runs do not consume the owner's interactive limits.
- Cost caps: max turns per run, max issues per night, workflow timeouts, one factory job at a time (concurrency group). A Console workspace spend limit is the hard cap.

## Deviation from Zühlke rule 5
Rule 5 says every model call goes through a gateway. We call Anthropic directly. Acceptable for a one-person project; the Console usage page is our audit trail.
