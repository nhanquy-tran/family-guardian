# Week 1 plan (MVP)

Start: 2026-11-17. Target: MVP deployed and tested on a real Windows laptop by 2026-11-23.

| Day | Daytime (human + Claude) | Overnight (factory) |
|---|---|---|
| 1 | Repo, docs, ADRs, OpenSpec, factory workflows, CI, monorepo skeleton, backlog. Accounts: Vercel, Supabase, Google OAuth, Chrome Web Store, Resend. | Trial run on 2-3 small issues |
| 2 | Review PRs, tune factory. Supabase schema, Google login, deploy. Submit extension skeleton to Chrome Web Store (unlisted). | Pairing flow, heartbeat API |
| 3 | Extension tracking accuracy (idle, multiple windows) | Dashboard today/week, devices |
| 4 | `.reg` installer tested on a real laptop | Site blocking (rules API + DNR) |
| 5 | Tamper alerts, security review | Focus score, timeline |
| 6 | End-to-end test on the kids' laptops, bug bash | Bug fixes |
| 7 | Invite test users, factory retro, v0.2 plan | - |

## Human-only tasks

These need the product owner's own accounts, credentials or approvals:

- [ ] Vercel account, import the GitHub repo
- [ ] Supabase project (region close to users), share project URL and anon key as Vercel env vars
- [ ] Google Cloud OAuth client (Web), consent screen "External", add redirect URL from Supabase
- [ ] Chrome Web Store developer account ($5) and first upload
- [ ] Resend account and API key
- [ ] Spend limit on the Anthropic Console workspace used by `CLAUDE_API_KEY`
- [ ] Daily: approve specs (merge `spec` PRs) and merge `factory` PRs

## Status log

- 2026-11-17: repo created (public), `CLAUDE_API_KEY` secret added, GitHub CLI installed.
- 2026-11-17: Day 1 foundation on `main`: docs, ADRs 0001-0010, OpenSpec, monorepo skeleton (web, extension, shared), factory workflows, CI green. Labels, milestone "v0.1 MVP" and backlog issues #1-#19 created. Human tasks: #1, #2, #3. First factory trial: #4, #5, #6 (pure logic, no accounts needed).
- 2026-11-17: First factory runs. Fixed: Claude action refuses bot-dispatched runs (`allowed_bots: github-actions`); GitHub blocks PR creation with `GITHUB_TOKEN` (added `FACTORY_TOKEN`); reviewer could not read issues (allowed `gh issue view`). Spec writer produced specs for #4, #5, #6 (PRs #20-#22), AI review ran on all three.
- 2026-11-17: Issue #1 done: Supabase project `gorggbnaidjszwhkzkzr` (Google provider on, URL config set), Google OAuth client (Testing mode, test users), Vercel project live at https://family-guardian-one.vercel.app.
- 2026-11-17: Chrome Web Store developer account registered (non-trader). Draft uploaded, extension ID `mohnkinbpagpelmlfmgkgaplfikdjjcb`. Submit for review after #4 and #11 (target day 3).
- 2026-11-17: Issue #3 done: FACTORY_TOKEN, Resend key in Vercel, Anthropic spend limit. All Day 1 human tasks done except submitting the extension for review (#2, day 3).
