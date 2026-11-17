## Decisions

- **Token copy, not import.** Vercel builds `apps/web` as its root, so importing `../../../../docs/design/tokens.css` may fail. Copy to `apps/web/src/styles/tokens.css`; a test asserts byte equality with `docs/design/tokens.css` so the copy cannot drift. No ADR: no new library or service.
- **Tailwind mapping** follows "Using it" in the style guide (`--color-*`, `--radius-card`, `--shadow-card`, `--font-sans`), plus `--color-accent-contrast`, `--color-line-2`, `--color-*-soft`, `--radius-sm`, `--radius-pill` as needed.
- **Inter** with `next/font/google` (weights 400, 500, 600). Geist imports are removed. Body font is `var(--font)`.
- **`ui.ts`** exports non-empty string constants (no fixed widths, no `whitespace-nowrap`): `container` (keeps unprefixed `p-4`, `sm:p-6`, `mx-auto`), `card` (no max width; login adds `max-w-sm`), `cardTitle`, `pageTitle`, `buttonPrimary`, `buttonSecondary`, `buttonDanger`, `input`, `pillGreen|Amber|Red|Accent|Grey`, `table` (wrapper with `overflow-x-auto`), `th`, `td`, `navLink`, `navLinkCurrent`, `alertError`, `alertWarning`. Buttons are `rounded-pill`, `min-h-10`, with a focus ring `ring-4 ring-accent-soft`.
- **Current nav link**: the shell has no pathname, so `DashboardShell` takes an optional `currentPath` prop; dashboard pages pass it. The current link gets `aria-current="page"` and `navLinkCurrent`.
- **Icon**: `docs/design/icon.svg` is copied to `apps/web/src/app/icon.svg` (favicon via Next file convention; `app/favicon.ico` is removed so it does not take precedence) and `apps/web/public/icon.svg` (used by `<img src="/icon.svg" alt="">`). A test asserts both equal the source.
- **Dark mode** only through tokens (`prefers-color-scheme`); components never use `dark:`.
- **Contrast (4.5:1)**: status pills and alerts use `text-ink` on the soft status background, with the strong colour as a dot or border, because strong status colours on soft backgrounds (notably amber) may be below 4.5:1. Token pairs that fail are reported in NOTES.md for a `docs/design` fix, not changed here.
- **Error and empty states** are not new data paths: offline banner uses `alertWarning`, error states `alertError`.

## Risks
- Mechanical edit across about 13 files; mitigated by the source-scan test (no palette colours, uses `ui.ts`).
- Class-name assertions in `login-form.test.ts`, `dashboard-shell.test.ts`, `styles-wiring.test.ts` and `ui.test.ts` change with this spec. The test writer updates only those, keeping all non-class assertions (hrefs, form actions, copy, `no-password.test.ts`) unmodified.
