# Roadmap

## v0.1 MVP (week of 2026-11-17)

Goal: a parent monitors and protects their child's Windows laptop browsing. 20 test families.

Status 2026-11-17 (end of day 1): about one day ahead. Scope unchanged; the gained day goes to an earlier store submission, an earlier real-laptop test and a hardening day. See [plan.md](plan.md). Optional v0.2 pull-in at the end of the week: daily time limits per category, only if store review and the real-device test are done.

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
| Week 1, day 1 | Step 03: agents spec and build, human approves specs and merges (reached on day 1) |
| Week 1, from day 1 evening | Step 04: Claude takes the spec and build gates, owner picks backlog items and handles escalations (ADR 0013) |
| Week 2-3 | Measure: rounds per item, escalations, cost per item; tune agent rules from `factory-learnings.md` |
| Later | Step 05 for low-risk areas (docs, tests, UI polish): no per-PR gate, owner validates the result |
