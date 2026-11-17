## 1. Tests first
- [x] 1.1 Update `styles-wiring.test.ts` (tokens, mapping, copy equality, Inter, icon files, build classes)
- [x] 1.2 Update `ui.test.ts` (exports, guide classes, no palette colours, focus, `overflow-x-auto`, no fixed widths)
- [x] 1.3 Update `login-form.test.ts` and `dashboard-shell.test.ts` (new class and brand scenarios, current page, nav wiring)
- [x] 1.4 Add `design-adoption.test.ts` and `src/styles/contrast.test.ts`

## 2. Foundation
- [x] 2.1 Copy `docs/design/tokens.css` to `apps/web/src/styles/tokens.css`; update `globals.css` (import, `@theme inline`, body)
- [x] 2.2 `layout.tsx`: Inter via `next/font/google`, remove Geist
- [x] 2.3 Copy `icon.svg` to `src/app/icon.svg` and `public/icon.svg`; delete `src/app/favicon.ico`
- [x] 2.4 Rewrite `components/ui.ts`

## 3. Screens
- [x] 3.1 Login page and `LoginForm`
- [x] 3.2 `DashboardShell` (sticky nav, optional `currentPath` override); new client `dashboard-nav.tsx` with `usePathname()`; `layout.tsx` passes no path
- [x] 3.3 Dashboard overview, children list, devices list, block rules, homework, usage/focus, install, settings, privacy, home page, offline banner
- [x] 3.4 Remove every `neutral-*`, palette colour and hex from components

## 4. Finish
- [x] 4.1 `npm run check` and `npm run build` pass
- [ ] 4.2 Manual: Vercel preview in light and dark, desktop and 375px, no horizontal scroll (not done by the developer: needs the preview)
- [x] 4.3 NOTES.md lists docs to update (`docs/design/style-guide.md` pill text colour, the failing pairs `--red` on `--card` (4.34:1), `--red` on `--red-soft` (3.60:1) and `--muted` on `--card` (4.25:1), `apps/web/CLAUDE.md` token copy rule)
