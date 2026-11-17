# Human setup guide (accounts and secrets)

Steps only the owner can do. Never paste keys or secrets into chat, issues or the repo.

Known values (not secret):

| Item | Value |
|---|---|
| Supabase project ref | `gorggbnaidjszwhkzkzr` |
| Supabase URL | `https://gorggbnaidjszwhkzkzr.supabase.co` |
| Google OAuth redirect URI | `https://gorggbnaidjszwhkzkzr.supabase.co/auth/v1/callback` |
| Google Cloud project | `family-guardian` (ID `winter-pivot-515007-u4`) |
| Vercel production URL | `https://family-guardian-one.vercel.app` |
| Chrome Web Store extension ID | `mohnkinbpagpelmlfmgkgaplfikdjjcb` (draft, not yet submitted) |

## 1. Google OAuth consent screen (issue #1)

Google Cloud console > Google Auth Platform > Overview > Get started (project `family-guardian`).

1. App information: App name `Family Guardian`, support email = your Gmail. Next.
2. Audience: **External**. Next.
3. Contact information: your Gmail. Next.
4. Finish: tick the Google API Services User Data Policy agreement. **Create**.
5. Audience page: stay in **Testing** for now and add each parent's Gmail under **Test users** (max 100). "Publish app" stays disabled until the Branding page has an app home page, privacy policy link and authorized domain, which need the Vercel URL and the `/privacy` page (issue #19). Publish then; basic scopes (email, profile, openid) need no verification.

## 2. Google OAuth client (issue #1)

Google Auth Platform > Clients > **Create client**.

1. Application type: **Web application**. Name: `Family Guardian web`.
2. Authorized JavaScript origins: leave empty for now (Supabase handles the flow).
3. Authorized redirect URIs: add `https://gorggbnaidjszwhkzkzr.supabase.co/auth/v1/callback`.
4. **Create**. Copy the **Client ID** and **Client secret** (download the JSON as a backup; keep it private).

## 3. Supabase Google provider (issue #1)

Supabase > project > Authentication > Sign In / Providers > **Google**.

1. Enable Sign in with Google.
2. Paste Client ID and Client secret. Save.
3. Authentication > Sign In / Providers > User Signups: turn **off** "Allow new users to sign up with email" style email providers if offered (ADR 0004: Google only). Keep Google enabled.
4. Authentication > URL Configuration: Site URL `http://localhost:3000` for now; add Redirect URL `http://localhost:3000/**`. After Vercel exists, change Site URL to the Vercel URL and add `https://<vercel-url>/**`.

## 4. Supabase keys you will need (do not share)

Project Settings > API (or API Keys):
- Project URL (above, not secret)
- `anon` / publishable key: public, used in the browser
- `service_role` / secret key: **secret**, server only

## 5. Vercel (issue #1)

1. https://vercel.com/new > sign in with GitHub > Import `nhanquy-tran/family-guardian`.
2. Root Directory: `apps/web`. Framework: Next.js (auto). Leave build settings default.
3. Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://gorggbnaidjszwhkzkzr.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key (server only: never give it a `NEXT_PUBLIC_` prefix; used by the device API, e.g. `/api/device/heartbeat`)
4. Deploy. Copy the production URL and put it in Supabase URL Configuration (step 3.4) and tell Claude the URL.

## 6. Chrome Web Store (issue #2)

1. https://chrome.google.com/webstore/devconsole > sign in with the Google account that will own the listing > pay the one-time $5 registration fee > verify the contact e-mail.
2. Claude prepares the zip (`npm run zip -w extension`) and the listing texts; you upload as **Unlisted** and submit.
3. Before building the zip, set `WXT_API_BASE_URL` to the production dashboard URL (https, no secret; see `apps/extension/.env.example`). Without it the extension builds but cannot pair or send data.

## 7. Resend and spend limit (issue #3)

1. https://resend.com > sign up > API Keys > Create (Sending access). Add as Vercel env `RESEND_API_KEY`.
2. Anthropic Console > Settings > Limits: set a monthly spend limit on the workspace of the key behind `CLAUDE_API_KEY` (e.g. $50 for week 1).

## 8. Supabase migrations from CI (ADR 0011)

1. Supabase > Account > Access Tokens: https://supabase.com/dashboard/account/tokens > Generate new token, name `family-guardian-ci`. Copy it.
2. Database password: the one you set when creating the project. If you did not keep it: Project Settings > Database > Reset database password (nothing uses it yet, so resetting is safe now).
3. GitHub repo secrets (https://github.com/nhanquy-tran/family-guardian/settings/secrets/actions/new):
   - `SUPABASE_ACCESS_TOKEN` = the token
   - `SUPABASE_DB_PASSWORD` = the database password

## 9. Offline alerts (issue #18)

Alerts stay off until all of this exists: the cron function only logs a warning and makes no calls, and the endpoint answers `500`.

1. Generate a secret, for example `openssl rand -hex 32`. Keep it for the next two steps.
2. Vercel > Settings > Environment Variables (Production): `ALERT_CRON_SECRET` = the secret, `ALERT_FROM_EMAIL` = `onboarding@resend.dev` (until a domain is verified in Resend). `RESEND_API_KEY` comes from section 7. Redeploy.
3. Supabase > SQL Editor, run once (same secret as in Vercel):
   ```sql
   select vault.create_secret('https://family-guardian-one.vercel.app', 'app_url');
   select vault.create_secret('<the secret>', 'alert_cron_secret');
   ```
4. To rotate the secret, update the Vault entry and the Vercel env together and redeploy; only one value works at a time.
5. Check: `select jobname, schedule from cron.job;` lists `offline-alerts` and `purge-pair-attempts`.

An alert e-mail is sent at most once per device per 24 hours, and a laptop that is simply switched off also triggers it.
