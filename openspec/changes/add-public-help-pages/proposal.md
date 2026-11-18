Depends on: #98
Touches: public-site, apps/web/src/app/sitemap.ts

# Public website: setup guide, FAQ and help pages in three languages (#99)

## Why
The home page from #98 links to `/<locale>/help` and `/<locale>/faq`, which are 404 until now. Parents need a setup guide, answers to the common questions and troubleshooting before and after they install.

## What changes
- Three pages per locale: `/<locale>/setup`, `/<locale>/faq`, `/<locale>/help`, using the locale layout, message files and language switcher from #98.
- Setup guide: ordered steps matching the real flow, linking to `/install` for the files.
- FAQ: at least 10 questions as `<details>`/`<summary>`.
- Help: five troubleshooting cases and an optional contact link (`mailto:` from `NEXT_PUBLIC_SUPPORT_EMAIL`, hidden when unset or malformed).
- Footer and home link to the three pages; `sitemap.xml` and `hreflang` include them.

## Out of scope
- Translating `/install`, `/privacy`, `/login` or the dashboard.
- A contact form, chat, ticketing or any stored or logged data (so no ADR).
- New dependencies, tracking, or any change to the device API, database, `proxy.ts` or what the extension collects.
- Facts not already true in `openspec/specs/` (the FAQ promises no numbers for limits or retention).
