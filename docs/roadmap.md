# Roadmap

## v0.1 MVP (week of 2026-11-17)

Goal: a parent monitors and protects their child's Windows laptop browsing. 20 test families.

- Google sign-in for parents, one family per account
- Add child, pair device with a code
- Extension for Chrome, Edge, Brave on Windows: domain + time tracking, idle detection, offline queue
- Dashboard: today and week, top sites, categories, timeline, devices with online/last seen
- Site blocking by domain and category
- Daily focus score
- `.reg` installer: force-install and no incognito
- E-mail alert when a device goes silent

## v0.2 Limits (next 2-3 weeks)

- Daily/weekly time limits per category or site group
- Allowed hours (e.g. no browsing after 21:00)
- "5 minutes left" warning, extra time from the parent's phone
- Weekly e-mail report for parents

## v0.3 Reach

- macOS installer (`.mobileconfig`)
- Linux install script
- Child weekly summary with a challenge
- Better categorisation (curated list + parent overrides shared across children)

## v1.0 Product

- Mature-content filtering (on-device)
- Optional end-to-end encryption
- Plans and billing
- Public Chrome Web Store listing, Edge Add-ons listing

## Factory roadmap

| When | Factory maturity (Zühlke steps) |
|---|---|
| Week 1 | Step 02-03: agents implement issues overnight, human approves spec and merges |
| Week 2-3 | Step 03: auto-merge low-risk changes (docs, tests) when all gates pass |
| Later | Step 04: human spot-checks a sample; factory metrics drive improvements |
