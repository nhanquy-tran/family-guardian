# Week 1 plan (MVP)

Start: 2026-11-17. Target: MVP deployed and tested on a real Windows laptop by 2026-11-23.

## Where we are (end of day 1, 2026-11-17)

About **one day ahead** of the original plan. Day 2's goals (schema, Google login, deploy) are done, and so is part of day 3 (activity tracker).

| Status | Items |
|---|---|
| Done (merged) | #4 tracker, #5 categories, #6 focus score, #7 schema + RLS (live in Supabase), #8 Google sign-in + dashboard shell (live) |
| Finishing tonight | #10 heartbeat API (build gate), #11 spec (extension pairing + heartbeat sender) |
| Spec approved, not built | #9 pairing (held by owner until day 2) |
| Spec written, waiting for gate | #13 devices page, #14 blocking rules, #17 installer |
| Not started | #12 dashboard overview, #15 DNR blocking, #16 focus on dashboard, #18 offline alert, #19 retention, #40 UI polish |
| Human | #2 Chrome Web Store: submit for review after #11 is built |

Factory cost so far: about $14 in agent runs (55 runs). Build time per item: 2-5 minutes. The constraint is no longer build speed: it is review quality, dependencies between items, and external waits (Chrome Web Store review, real-device testing).

## Revised plan

| Day | Goal | Items |
|---|---|---|
| 2 (18 Nov) | **First data flows end to end**: pair a browser, heartbeats land in Supabase | Build #9, then #11 (needs #9 and #10). Submit the extension to the Chrome Web Store (#2). Gate specs #13, #14, #17. Spec #12, #18 |
| 3 (19 Nov) | **Parent sees real data; installer works** | Build #12 overview, #13 devices, #17 `.reg` installer. Install on a real Windows laptop (unpacked or store build) |
| 4 (20 Nov) | **Blocking and focus** | Build #14 rules API, #15 DNR blocking, #16 focus on dashboard. Spec + build #18 offline alert, #19 retention |
| 5 (21 Nov) | **Hardening** | #40 UI polish, Playwright end-to-end smoke test, Supabase security advisor, publish Google OAuth app (needs /privacy, done), Resend sender domain |
| 6 (22 Nov) | **Real-world test** | Kids' laptops for a day, bug bash, invite the first 3-5 families |
| 7 (23 Nov) | **Buffer and retro** | Fixes, factory retro (cost, rounds, learnings), v0.2 plan |

### What being a day ahead means

- **Keep the MVP scope**; use the gained day for quality and the external risks, not new features:
  1. Chrome Web Store review is the critical path (unknown duration); submitting on day 2 instead of day 3 buys a day.
  2. A real-laptop test on day 3 (not day 6) finds policy/install problems early.
  3. Day 5 becomes a hardening day (end-to-end test, security review) instead of feature catch-up.
- **Optional pull-in from v0.2** on day 6-7 only if the store review is through and the real-device test passed: daily time limits per category (smallest useful v0.2 item).
- **Risks**: store review time; Google OAuth app publishing (branding verification may need the domain); one-at-a-time builds where items share files (#9 then #11).

## Human-only tasks

These need the product owner's own accounts, credentials or approvals:

- [x] Vercel account, import the GitHub repo
- [x] Supabase project (region close to users), share project URL and anon key as Vercel env vars
- [x] Google Cloud OAuth client (Web), consent screen "External", add redirect URL from Supabase
- [x] Chrome Web Store developer account ($5) and draft upload; submit for review on day 2
- [x] Resend account and API key
- [x] Spend limit on the Anthropic Console workspace used by `CLAUDE_API_KEY`
- [x] Gates delegated to Claude from 2026-11-17 (ADR 0013); owner picks backlog items and handles escalations

## Status log

- 2026-11-17: repo created (public), `CLAUDE_API_KEY` secret added, GitHub CLI installed.
- 2026-11-17: Day 1 foundation on `main`: docs, ADRs 0001-0010, OpenSpec, monorepo skeleton (web, extension, shared), factory workflows, CI green. Labels, milestone "v0.1 MVP" and backlog issues #1-#19 created. Human tasks: #1, #2, #3. First factory trial: #4, #5, #6 (pure logic, no accounts needed).
- 2026-11-17: First factory runs. Fixed: Claude action refuses bot-dispatched runs (`allowed_bots: github-actions`); GitHub blocks PR creation with `GITHUB_TOKEN` (added `FACTORY_TOKEN`); reviewer could not read issues (allowed `gh issue view`). Spec writer produced specs for #4, #5, #6 (PRs #20-#22), AI review ran on all three.
- 2026-11-17: Issue #1 done: Supabase project `gorggbnaidjszwhkzkzr` (Google provider on, URL config set), Google OAuth client (Testing mode, test users), Vercel project live at https://family-guardian-one.vercel.app.
- 2026-11-17: Chrome Web Store developer account registered (non-trader). Draft uploaded, extension ID `mohnkinbpagpelmlfmgkgaplfikdjjcb`. Submit for review after #4 and #11 (target day 3).
- 2026-11-17: Issue #3 done: FACTORY_TOKEN, Resend key in Vercel, Anthropic spend limit. All Day 1 human tasks done except submitting the extension for review (#2, day 3).
- 2026-11-17 (end of day 1): #4-#8 merged; schema live; Google sign-in live; factory runs in step 04 with Claude as delegated gate (ADR 0013); 10 factory learnings recorded. Revised plan: about one day ahead, scope unchanged.
- 2026-11-17 (close of day 1): #10 heartbeat API merged (migration applied, production returns 401 for unknown tokens), #11 spec approved after one fix round. Tomorrow starts with build #9, then #11, then the Chrome Web Store submission.
- 2026-11-18: #9 pairing and #17 installer merged; specs #12, #13, #14, #17 approved after one round each; PAIR_RATE_LIMIT_SECRET added by owner.
- 2026-11-18: #12 usage overview and #18 offline alerts merged. Owner setup done: extension 0.2.0 submitted to the Chrome Web Store (unlisted), ALERT_CRON_SECRET/ALERT_FROM_EMAIL in Vercel, Vault entries. Verified: pg_cron -> Vault -> pg_net -> /api/alerts/offline returns 200 with counts; jobs offline-alerts (*/5) and purge-pair-attempts (daily) scheduled.
- 2026-11-18: Owner product decision: offline e-mails become a digest (daily 08:00 default, weekly on Monday option, parent-chosen time, per family). Issue #58 replaces #18's per-incident e-mail.
