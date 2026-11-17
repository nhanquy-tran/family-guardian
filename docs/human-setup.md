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
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key
4. Deploy. Copy the production URL and put it in Supabase URL Configuration (step 3.4) and tell Claude the URL.

## 6. Chrome Web Store (issue #2)

1. https://chrome.google.com/webstore/devconsole > sign in with the Google account that will own the listing > pay the one-time $5 registration fee > verify the contact e-mail.
2. Claude prepares the zip (`npm run zip -w extension`) and the listing texts; you upload as **Unlisted** and submit.

## 7. Resend and spend limit (issue #3)

1. https://resend.com > sign up > API Keys > Create (Sending access). Add as Vercel env `RESEND_API_KEY`.
2. Anthropic Console > Settings > Limits: set a monthly spend limit on the workspace of the key behind `CLAUDE_API_KEY` (e.g. $50 for week 1).
