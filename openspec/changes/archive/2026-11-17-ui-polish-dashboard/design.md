# Design

## Decisions

1. **Wire Tailwind first.** Without it no class has any effect. The developer reads `node_modules/next/dist/docs/` and the typings of the installed `@tailwindcss/turbopack`, and wires that package. If that does not work with `next build`, use the documented `@tailwindcss/postcss` plus `apps/web/postcss.config.mjs`, declared in `apps/web` devDependencies (Vercel installs per app, see platform-notes). Verified by a config test and by the built CSS containing a class used by the login page.
2. **Style constants in one module** `apps/web/src/components/ui.ts` exporting plain strings (`card`, `buttonPrimary`, `pageTitle`, `container`). Components compose them. No new library, no CSS-in-JS.
3. **Mobile first**: base classes target 375 px; `sm:` only widens. Nav is `flex flex-wrap gap-x-4 gap-y-2`, so it never forces horizontal scroll.
4. **Tests assert structure, not pixels**: `renderToStaticMarkup` checks for the layout classes and that the markup contracts from #8 still hold.
5. Each existing dashboard page's top-level heading uses `pageTitle`; no content change.

## Risks

- Existing tests (`login-form.test.ts`, `dashboard-shell.test.ts`) must keep passing with their assertions unchanged.
- Preview and production use the same config, so missing Tailwind wiring would show only as unstyled pages; the wiring test and build-output check guard that.
