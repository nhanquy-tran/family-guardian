# 0004. Google sign-in only for parents

Date: 2026-11-17. Status: accepted.

## Decision
Parents sign in with Google through Supabase Auth. No e-mail/password accounts, no password reset flows.

## Consequences
- Less code and no password storage.
- Needs a Google Cloud OAuth client and consent screen (human task).
- Parents without a Google account cannot use the MVP.
