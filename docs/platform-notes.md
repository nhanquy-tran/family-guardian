# Platform notes

Facts about the platforms we build on that caused real defects or failures. Every agent reads this before writing a spec, test or code. Add a line whenever a platform behaviour surprises a gate.

## Supabase / Postgres

- **PostgREST returns at most 1000 rows per request** by default. Never read raw `usage_minutes` (or any growing table) and aggregate in TypeScript; aggregate in SQL (functions with `security invoker` so RLS applies), and page explicitly with `.range()` when more rows are possible. (#12)
- **Migrations must be newer than the last applied one**; Supabase refuses older timestamps. Name new files with the current UTC time at build time. Never edit an applied migration. (#13)
- **Read `supabase/migrations/` on main before designing schema changes**: never create a column, function, trigger or grant that already exists; reference it. (#13, #14)
- Column-level grants: `children` and `devices` use explicit column grants; a new parent-visible or parent-editable column needs its own `grant select/update (col)`. (#10, #13)
- `security definer` functions: `set search_path = ''` and `revoke execute ... from public, anon, authenticated`. (#7, #10)
- `pg_cron` / `pg_net` / Vault are not available in the PGlite test harness: guard their use in migrations and verify on production after merge. (#18)

## Vercel / Next.js

- **Previews share the production database**, which gets a PR's migration only on merge. DB-dependent behaviour of a migration PR can only be verified on production after merge. (#10)
- New environment variables apply only to **new deployments**: redeploy after adding one. (#9)
- `next build` type-checks every `.ts` file under the app, including tests: each app declares the dev tools its files import. (#8)
- React server rendering of forms with server actions **injects an inline `<script>`** (form replay). Never assert "no `<script>`" to prove "works without JavaScript"; assert plain links/forms instead. (#13)
- Vercel is on **Pro** (since 2026-11-18). Production builds only from `main` when `apps/web`, `packages`, dependencies or `vercel-ignore.sh` change; previews build only for `factory/*` branches (the build gate's UI check). Spec, docs and other branches are skipped. Hobby's daily deployment limit stopped all deploys on 2026-11-17.
- `x-forwarded-for` is trustworthy only on Vercel (it overwrites it).

## Chrome / Edge / Brave extensions (MV3)

- **Guest windows do not load extensions**: policy `BrowserGuestModeEnabled=0` is required, with `IncognitoModeAvailability=1` (Chrome, Brave) / `InPrivateModeAvailability=1` (Edge). (#17)
- Force-install via `ExtensionInstallForcelist` on non-domain-joined Windows works only for Chrome Web Store items (ADR 0009).
- The background service worker can be stopped at any time: keep state in `chrome.storage`, register listeners synchronously.
- `navigator.brave` is not reliable in the service worker: detect the browser in a page context. (#11)
- Request only permissions the current version uses; unused broad permissions (`<all_urls>`, `declarativeNetRequest`) slow or fail store review.
- Calls from the service worker to our API need a host permission for the API origin (no CORS headers on our routes).

## Product behaviour

- A laptop that is switched off looks exactly like a removed extension. Alerts must not fire every evening (throttle, wording). (#18)
- A server-side bug that returns 401 must not wipe every device: keep local data on 401 and recover on the next success. (#11)
- Queues must never get stuck on one bad item or on size: validate items one by one, cap batch sizes, and give the client a distinct "split the batch" signal (413). (#10)

## GitHub

- **GitHub runs no PR workflows on a PR that conflicts with its base**, silently. The watchdog merges main or asks `@claude`. (#13)
- Pushes and PRs made with `GITHUB_TOKEN` do not trigger other workflows; the factory uses `FACTORY_TOKEN`.
- A PR created with a label fires `opened` and `labeled` at once: never let one cancel the other (concurrency groups).
- Labels added with `GITHUB_TOKEN` do not trigger the router; the scheduler labels with `FACTORY_TOKEN`.
- Agent steps get no repository token in their shell (`GH_TOKEN: ""`): pushes, PRs and labels are done by workflow steps.

## Factory agent permissions

- Agents can only delete files with `git rm` (allowed for developer, debugger and `@claude`). CI fails any PR that changes, renames or deletes a migration already on main. Edit and Write tools cannot delete.
- Permission rules for the verifier: a narrow `Write(<glob>)` did not match the absolute path the agent used, so the report was lost. The verifier gets `Write` and the workflow reverts every edit except `VERIFY.md`.

- `bump_rules_version()` (child-level, used by `block_rules` and `child_category_limits`) bumps twice on UPDATE (old and new child); `bump_family_rules_version()` bumps once since #91. Specs that count versions must say so.
- The agent action fails a step that goes over `--max-turns` even when the work is done: agent steps use `continue-on-error` and the gates decide (#87 lost a finished spec at a cap of 20).

## OpenSpec

- `openspec/specs/` is current behaviour. A change that alters existing behaviour uses MODIFIED (full requirement text, all scenarios kept or replaced) or REMOVED; ADDED for an existing requirement name fails archive.
- MODIFIED cannot just drop a scenario: give a replacement scenario, or REMOVED plus ADDED.
- `openspec validate --specs --strict` needs a real `## Purpose` in every spec; archive fails on placeholders.
- The shared setup action restores `node_modules` from cache and skips `npm ci`; it must still run the extension's postinstall (`wxt prepare`), or vitest cannot load extension tests (#114's red-phase eval reported "tests do not run").
- A build whose `Touches` overlap an open, unmerged factory PR conflicts on rebase: the scheduler treats `in-review` like `in-progress`, and a conflicting build still pushes its work and opens the PR as `needs-human` (#89 lost a finished build before this).
