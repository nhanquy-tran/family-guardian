# Notes: add-public-help-pages (#99)

## Summary
- Messages: `setup.*`, `faq.*` (q1..q11 / a1..a11), `help.*`, `footer.setup` in en/vi/zh (flat strings).
- Components `setup-guide.tsx`, `faq.tsx`, `help.tsx` (no copy, no env reads); pages under `app/[locale]/{setup,faq,help}` with `dynamicParams = false`; shared `lib/i18n/page-metadata.ts` builds canonical and hreflang.
- `sitemap.ts` lists 13 URLs; footer links to setup, FAQ and help; home links to `/<locale>/setup`.
- Verified by the scenario tests in `setup-guide.test.tsx`, `faq.test.tsx`, `help.test.tsx`, `site-routing.test.ts`, `home.test.tsx`, `site-purity.test.ts` (all pass in `npm run check`; `npm run build` passes).

## Needs a human
- The tools refuse edits to `.env*`: add the line `NEXT_PUBLIC_SUPPORT_EMAIL=` to `apps/web/.env.example` (task 2.2). The help page hides the contact section until the variable is set.

## Docs to update
- `docs/architecture.md`: public site section lists setup, faq and help pages and the sitemap.
- `apps/web/CLAUDE.md`: public pages take messages as props; `NEXT_PUBLIC_SUPPORT_EMAIL` is read only in `help/page.tsx`.
- `docs/platform-notes.md`: `NEXT_PUBLIC_*` variables are inlined at build, so redeploy after setting.
