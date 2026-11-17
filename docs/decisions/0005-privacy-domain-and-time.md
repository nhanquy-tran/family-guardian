# 0005. Collect only domain and time

Date: 2026-11-17. Status: accepted.

## Decision
The extension sends only the registrable domain (e.g. `youtube.com`), active seconds per minute, blocked attempts (domain only) and browser/OS name. Never full URLs, page titles, content, searches, keystrokes or screenshots.

## Consequences
- Simpler privacy story for parents, kids and the Chrome Web Store review.
- Category is derived from the domain only, so e.g. YouTube homework vs. entertainment cannot be told apart. Acceptable for MVP.
