# 0005. Collect only domain and time

Date: 2026-11-17. Status: accepted.

## Decision
The extension sends only the registrable domain (e.g. `youtube.com`), active seconds per minute, blocked attempts (domain only) and browser/OS name. Never full URLs, page titles, content, searches, keystrokes or screenshots.

## Consequences
- Simpler privacy story for parents, kids and the Chrome Web Store review.
- Category is derived from the domain only, so e.g. YouTube homework vs. entertainment cannot be told apart. Acceptable for MVP.

## Amendment 2026-11-17
The extension may also send its own version string (`extensionVersion`, at most 32 characters) next to the browser and OS name. It describes the installed software, not the child or their activity, and the devices page shows it so parents and support can see outdated extensions. Everything else in this ADR is unchanged.
