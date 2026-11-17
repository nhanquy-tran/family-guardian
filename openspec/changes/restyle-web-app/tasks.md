## 1. Tests first
- [ ] 1.1 Update `styles-wiring.test.ts` (tokens, mapping, copy equality, Inter, icon files, build classes)
- [ ] 1.2 Update `ui.test.ts` (exports, guide classes, no palette colours, focus, `overflow-x-auto`, no fixed widths)
- [ ] 1.3 Update `login-form.test.ts` and `dashboard-shell.test.ts` (new class and brand scenarios, current page)
- [ ] 1.4 Add `design-adoption.test.ts` and `src/styles/contrast.test.ts`

## 2. Foundation
- [ ] 2.1 Copy `docs/design/tokens.css` to `apps/web/src/styles/tokens.css`; update `globals.css` (import, `@theme inline`, body)
- [ ] 2.2 `layout.tsx`: Inter via `next/font/google`, remove Geist
- [ ] 2.3 Copy `icon.svg` to `src/app/icon.svg` and `public/icon.svg`; delete `src/app/favicon.ico`
- [ ] 2.4 Rewrite `components/ui.ts`

## 3. Screens
- [ ] 3.1 Login page and `LoginForm`
- [ ] 3.2 `DashboardShell` (sticky nav, `currentPath`) and pass the current path from dashboard pages
- [ ] 3.3 Dashboard overview, children list, devices list, block rules, homework, usage/focus, install, settings, privacy, home page, offline banner
- [ ] 3.4 Remove every `neutral-*`, palette colour and hex from components

## 4. Finish
- [ ] 4.1 `npm run check` and `npm run build` pass
- [ ] 4.2 Manual: Vercel preview in light and dark, desktop and 375px, no horizontal scroll
- [ ] 4.3 NOTES.md lists docs to update (`docs/design/style-guide.md` pill text colour, any failing contrast pair, `apps/web/CLAUDE.md` token copy rule)
