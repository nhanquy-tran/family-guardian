# Family Guardian style guide

One visual language for the intro page, the parent web app and the factory control pane. Simple, calm and modern: soft grey-blue ground, white rounded cards, pill buttons, one blue accent taken from the app icon.

- Tokens (colours, radii, shadows, fonts): [`tokens.css`](tokens.css). Use the variables, never raw hex values.
- Icon: [`icon.svg`](icon.svg), a vector of `apps/extension/public/icon/*.png`.
- Reference implementation: `tools/factory-dashboard/` (control pane).

The layout language (soft ground, floating cards, pill controls, tinted status pills, hatched "waiting" areas) was taken from a reference site and recoloured to our brand. Do not copy other products' names, logos, copy or illustrations.

## Principles

1. **Content on cards.** The page is a soft `--ground`; everything people read or use sits on a `--card` with `--radius` and `--shadow`. No hard borders around cards.
2. **One accent.** Blue (`--accent`) marks the primary action, links, focus and the current tab. Everything else is ink and greys. Status colours only for status.
3. **Quiet type.** Inter, tight headings (`letter-spacing: -0.02em`), 14px body in apps, 16 to 18px body on the intro page.
4. **Round and soft.** Pills for buttons, tabs and labels; 20px cards; 10 to 14px for small inner surfaces.
5. **Readable first.** Text contrast at least 4.5:1, focus always visible (4px `--accent-soft` ring), works at 375px width and in dark mode.

## Brand

| Use | Asset |
|---|---|
| App icon, favicon, nav brand | `icon.svg` (blue tile, white shield, blue dot). Minimum 16px. Keep the rounded tile; do not recolour the shield. |
| Wordmark | "Family Guardian" in Inter 600, `letter-spacing: -0.03em`, next to the icon with an 8 to 10px gap |
| Brand blue | `#2563eb` (`--accent`, light) and `#5b8cff` (dark) |

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ground` | `#e7ebf3` | `#0c0f16` | page background |
| `--shell` | `#f5f7fb` | `#131823` | sunken areas: columns, code, secondary panels |
| `--card` | `#ffffff` | `#1a2030` | cards, dialogs, nav bar |
| `--line` / `--line-2` | `#e8ecf3` / `#d6dce7` | `#262d3d` / `#333c50` | dividers / control borders |
| `--ink` / `--ink-2` / `--muted` | `#131722` / `#394150` / `#737b8c` | `#eef1f7` / `#cfd5e2` / `#8f98ab` | text levels |
| `--accent` / `--accent-ink` / `--accent-soft` | `#2563eb` / `#1d4ed8` / `#dfe8fd` | `#5b8cff` / `#8fb0ff` / `#1e2a4a` | primary, links, tint |
| `--green` (+`-soft`) | `#1f9d6b` | `#4cc792` | success, allowed, focused time |
| `--amber` (+`-soft`) | `#c98a12` | `#e3b04b` | waiting, warning, in progress |
| `--red` (+`-soft`) | `#dc3d55` | `#f4707f` | errors, blocked, destructive actions |
| `--indigo`, `--cyan` (+`-soft`) | `#5b5bd6`, `#0e8fb0` | `#9b9bff`, `#3cc2e0` | extra chart series and categories |

Status pills use the soft colour as background, `--ink` text and a strong-colour border (strong-colour text fails contrast). Charts use `--accent` first, then `--cyan`, `--indigo`, `--amber`, `--green`; waiting or idle time uses `--hatch`.

Failing light-mode pairs: `--red` on `--card` (4.34:1), `--red` on `--red-soft` (3.60:1) and `--muted` on `--card` (4.25:1). `--muted` is for placeholders and disabled text only; captions and labels use `--ink-2`.

## Typography

Font: Inter (Google Fonts, weights 400, 500, 600), with the system stack as fallback. Numbers in tables and tiles use `font-variant-numeric: tabular-nums`.

| Role | Size / weight | Notes |
|---|---|---|
| Hero title (intro) | `clamp(38px, 5.2vw, 62px)` / 600 | line-height 1.04; one key phrase may use `--grad-text` |
| Section title (intro) | `clamp(28px, 3.6vw, 40px)` / 600 | |
| Lead paragraph | 18px / 400, `--ink-2` | line-height 1.55, max 32em |
| Eyebrow | 12px / 600, uppercase, `letter-spacing: 0.1em`, `--accent-ink` | above hero and section titles |
| Page title (app) | 22px / 600 | |
| Card title | 18 to 20px / 600 | |
| Body (app) | 14px / 400 | line-height 1.45 |
| Label, caption | 12 to 12.5px / 500, `--ink-2` | |
| Big number (tile) | 26px / 600, `letter-spacing: -0.02em` | |

## Spacing and shape

- 4px grid: 4, 8, 12, 16, 24, 32, 48, 72. Card padding 24px (16px on phones). Gap between cards 16px.
- Radii: `--radius` 20px (cards, dialogs), `--radius-md` 14px (inner panels), `--radius-sm` 10px (small cards, inputs, icon buttons), `--radius-pill` (buttons, pills, tabs).
- Shadows: `--shadow` for cards; `--shadow-lift` only for hero visuals and floating elements.
- Max content width: 1200px on the intro page, 1500px in data-heavy app screens.

## Components

| Component | Spec |
|---|---|
| Button | pill, height 36 to 40px, padding 0 18px, weight 500, 1px `--line-2` border on `--card`. Hover: border `--muted`. Active: `scale(.98)`. |
| Primary button | `--accent` background, `--accent-contrast` text, no border. One per view. |
| Ghost / danger | transparent background (hover `--line`) / `--ink` text with a `--red` border (not `--red` text) |
| Small button | height 28 to 32px, padding 0 12px, 13px text |
| Icon button | 34px square, `--radius-sm`, transparent, `--muted` icon; hover `--line` |
| Input / select | height 40px, `--radius-sm`, `--line-2` border, focus: border `--accent` + `0 0 0 4px var(--accent-soft)` |
| Card | `--card`, `--radius`, `--shadow`, padding 24px, title row with actions right-aligned |
| Tile (KPI) | small card: big number + muted label underneath |
| Pill (status) | height 24 to 28px, pill radius, 12.5px / 500, soft background + `--ink` text + strong border (`green`, `amber`, `red`, `accent`, grey = `--line` + `--ink-2`) |
| Nav bar | sticky, 64px, `--ground` at 82% with `backdrop-filter: blur(12px)`, brand left, links in `--ink-2` (current one as a soft-accent pill), actions right |
| Tabs | pill buttons; current tab `--accent-soft` background and `--accent-ink` text |
| Table | inside a card, no outer border; header 12px `--muted` 500; rows separated by `--line`; numbers right-aligned; row hover `--shell` |
| Dialog | `--card`, `--radius`, padding 24px, backdrop `rgb(12 15 22 / .45)` with a 4px blur |
| Toast | bottom centre, pill, `--ink` background, `--card` text; errors on `--red` |
| Progress / ring | track `--line`, fill `--accent` (or a status colour) |
| Empty state | muted text centred in the card, one action button |

## Dark mode

Follows the system (`prefers-color-scheme`) and can be forced with `data-theme="dark"` or `"light"` on `<html>`. Only the tokens change; components never test the theme themselves. Give `body` an explicit `background: var(--ground)`.

## Using it

**Static pages** (intro page, control pane): link Inter and the tokens, then build components from the variables.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="tokens.css">
```

**Parent web app** (Next.js, Tailwind 4): import the tokens in `apps/web/src/app/globals.css` and expose them to Tailwind, then use classes such as `bg-card text-ink rounded-card shadow-card`.

```css
@import "tailwindcss";
@import "../../../../docs/design/tokens.css"; /* or a copy under src/styles */

@theme inline {
  --color-ground: var(--ground);
  --color-shell: var(--shell);
  --color-card: var(--card);
  --color-line: var(--line);
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-accent-ink: var(--accent-ink);
  --color-accent-soft: var(--accent-soft);
  --color-green: var(--green);
  --color-amber: var(--amber);
  --color-red: var(--red);
  --radius-card: var(--radius);
  --shadow-card: var(--shadow);
  --font-sans: var(--font);
}
```

Use `next/font/google` for Inter in the web app instead of the stylesheet link.
