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
