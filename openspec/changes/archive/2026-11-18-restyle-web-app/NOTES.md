# Notes: restyle-web-app (#65)

## Summary

- Tokens: `docs/design/tokens.css` copied byte-for-byte to `apps/web/src/styles/tokens.css`; `globals.css` imports it, maps it in `@theme inline`, and sets `body` to `var(--ground)` / `var(--font)`.
- Inter via `next/font/google` replaces Geist. The icon is `src/app/icon.svg` (favicon) and `public/icon.svg`; `favicon.ico` removed with `git rm`.
- `components/ui.ts` rewritten with the 20 shared constants, built from token classes only. Status uses `text-ink` with a coloured border (no `text-red/amber/green/muted`, except `placeholder:text-muted`).
- `DashboardShell` has a sticky header (icon, wordmark, family name, Settings, Sign out) and renders the new client `dashboard-nav.tsx` (`usePathname()`, `aria-current="page"`, sub-path matching). `currentPath` is an optional override; `layout.tsx` passes none.
- The shell icon has `loading="lazy"`. Without it React emits a preload `<link>` before the root `<div>`, which breaks `dashboard-shell.test.ts` "page container" (`^<div`).
- All pages and views now use `ui.ts`. No `neutral-*`, palette colours, hex or `dark:` remain in `app/` or `components/`.

Verification per scenario:
- Tailwind wiring, tokens mapping, token copy, Inter, icons, build classes: `styles-wiring.test.ts`
- ui.ts constants, no fixed widths, focus, tables, no palette, contrast classes: `ui.test.ts`
- Login card and error alert: `login-form.test.ts`
- Shell header, nav, current page, container, client nav: `dashboard-shell.test.ts`
- No hard-coded colours, pages use ui.ts, offline banner, no `dark:`: `design-adoption.test.ts`
- Text contrast pairs: `src/styles/contrast.test.ts`
- `npm run check` (542 pass, 1 skipped) and `npm run build` pass.

Not done: task 4.2 (manual check of the Vercel preview in light/dark, desktop and 375px).

## Test concerns

None.

## Docs to update

- `docs/design/style-guide.md`: status pills use `--ink` text with a strong-colour border, not strong-colour text. Record the failing light-mode pairs: `--red` on `--card` (4.34:1), `--red` on `--red-soft` (3.60:1), `--muted` on `--card` (4.25:1). `--muted` is for placeholders and disabled text only; captions and labels use `--ink-2`. Same for "Ghost / danger" (`--red` text).
- `apps/web/CLAUDE.md`: `src/styles/tokens.css` is a copy of `docs/design/tokens.css` (a test asserts equality; update both together). Components never use `dark:`; colours come from token classes in `src/components/ui.ts`.
- `docs/architecture.md`: none.
