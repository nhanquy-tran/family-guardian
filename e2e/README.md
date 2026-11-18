# End-to-end tests

Playwright tests for the parent dashboard against a local Supabase stack, with generated data in five stages (ADR 0019).

## Run

1. Start Docker Desktop, then at the repo root: `npx supabase start` (applies `supabase/migrations`).
2. Once: `npx playwright install chromium` in `e2e/`.
3. `npm run e2e`: builds and starts the web app on port 3100, runs every stage on desktop and mobile, writes screenshots, then removes all e2e data.

Screenshots: `e2e/screenshots/<stage>/<desktop|mobile>/*.png`; open `e2e/screenshots/index.html` for the contact sheet.

## Data

| Stage | What exists |
|---|---|
| `empty` | Parent only |
| `onboarded` | Mia (2 devices), Leo (1 device), Noah (none); no usage |
| `week` | Seven days of usage: Mia focused (homework afternoons), Leo distracted (games, TikTok, late nights) |
| `rules-applied` | From 3 days ago Leo has tiktok.com and the social category blocked and games capped at 60 min; from yesterday his allowed hours are 07:00 to 20:00. Usage and block events reflect it. Mia gets a 90 min entertainment limit she stays under, so a limit shows on her rules page without changing her data |
| `alerts` | Mia's Family PC offline for 3 days, with an open offline alert |

- Seed one stage by hand: `npm run e2e:seed -- --stage week` (signs nothing in; sign-in is Google-only).
- Remove everything: `npm run e2e:reset`. Every seed tears down first, and every run ends with a teardown; `E2E_KEEP=1 npm run e2e` keeps the data.
- Only accounts at `@e2e.family-guardian.test` and their families are touched, and only on localhost.
