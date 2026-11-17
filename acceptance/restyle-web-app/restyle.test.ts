import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardShell } from "../../apps/web/src/components/dashboard-shell";
import { LoginForm } from "../../apps/web/src/components/login-form";
import * as uiModule from "../../apps/web/src/components/ui";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ui = uiModule as Record<string, unknown>;

function currentLinks(path: string): string[] {
  const html = renderToStaticMarkup(createElement(DashboardShell, { familyName: "Le family", currentPath: path }));
  return (html.match(/<a[^>]*>/g) ?? [])
    .filter((a) => a.includes('aria-current="page"'))
    .map((a) => a.match(/href="([^"]*)"/)?.[1] ?? "");
}

describe("restyle-web-app acceptance", () => {
  it("acceptance: current nav link follows path segments, not string prefixes", () => {
    expect(currentLinks("/dashboard/devices/abc/edit")).toEqual(["/dashboard/devices"]);
    expect(currentLinks("/dashboard/childrenx")).toEqual([]);
    expect(currentLinks("/dashboard/settings")).toEqual([]);
    expect(currentLinks("/dashboard/install")).toEqual(["/dashboard/install"]);
  });

  it("acceptance: icon and token copies are byte-identical to the design source", () => {
    const pairs: [string, string][] = [
      ["docs/design/tokens.css", "apps/web/src/styles/tokens.css"],
      ["docs/design/icon.svg", "apps/web/src/app/icon.svg"],
      ["docs/design/icon.svg", "apps/web/public/icon.svg"],
    ];
    for (const [a, b] of pairs) {
      expect(existsSync(join(root, b)), b).toBe(true);
      expect(readFileSync(join(root, b), "utf8"), b).toBe(readFileSync(join(root, a), "utf8"));
    }
    expect(existsSync(join(root, "apps/web/src/app/favicon.ico"))).toBe(false);
  });

  it("acceptance: every shared class string is token based and has no fixed width", () => {
    const names = [
      "container", "card", "cardTitle", "pageTitle", "buttonPrimary", "buttonSecondary", "buttonDanger", "input",
      "pillGreen", "pillAmber", "pillRed", "pillAccent", "pillGrey", "table", "th", "td", "navLink", "navLinkCurrent",
      "alertError", "alertWarning",
    ];
    for (const n of names) {
      const v = ui[n];
      expect(typeof v, n).toBe("string");
      const s = String(v);
      expect(s.trim().length, n).toBeGreaterThan(0);
      expect(s, n).not.toMatch(/\bdark:|neutral-|#[0-9a-fA-F]{3,8}\b|w-\[|whitespace-nowrap/);
      expect(s, n).not.toMatch(/\b(red|green|amber|blue|slate|gray|zinc)-\d{2,3}\b/);
    }
  });

  it("acceptance: login card has one primary button, icon and no hard-coded colours", () => {
    const html = renderToStaticMarkup(createElement(LoginForm, { error: "auth" }));
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html.match(/<img[^>]*src="\/icon\.svg"/g)).toHaveLength(1);
    expect(html).toContain(String(ui.card));
    expect(html).not.toMatch(/neutral-|-(red|amber)-\d{2,3}/);
    expect(html).toContain("Sign-in failed. Please try again.");
  });

  it("acceptance: dark mode text pairs and status soft backgrounds stay readable", () => {
    const css = readFileSync(join(root, "apps/web/src/styles/tokens.css"), "utf8");
    const darkPart = css.slice(css.indexOf("prefers-color-scheme: dark"), css.indexOf(':root[data-theme="dark"]'));
    const get = (block: string, name: string): string =>
      block.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? "#000000";
    const lum = (hex: string): number => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string): number => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const bg of ["--card", "--shell", "--ground", "--red-soft", "--amber-soft", "--green-soft"]) {
      expect(ratio(get(darkPart, "--ink"), get(darkPart, bg)), `dark ink on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio(get(css, "--accent-contrast"), get(css, "--accent"))).toBeGreaterThanOrEqual(4.5);
  });
});
