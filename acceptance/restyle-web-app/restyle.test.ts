import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardShell } from "../../apps/web/src/components/dashboard-shell";
import { LoginForm } from "../../apps/web/src/components/login-form";
import * as uiModule from "../../apps/web/src/components/ui";

const root = join(__dirname, "..", "..");
const ui = uiModule as unknown as Record<string, string>;
const tokens = (s: string): string[] => s.split(/\s+/).filter(Boolean);
const shell = (currentPath?: string): string =>
  renderToStaticMarkup(
    createElement(DashboardShell, { familyName: "Nguyen family", ...(currentPath ? { currentPath } : {}) }, "x"),
  );
const currentHrefs = (html: string): string[] =>
  ((html.match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? "").match(/<a[^>]*>/g) ?? [])
    .filter((a) => a.includes('aria-current="page"'))
    .map((a) => a.match(/href="([^"]*)"/)?.[1] ?? "");

describe("acceptance: restyle web app", () => {
  it("acceptance: current page matches sections by path boundary", () => {
    expect(currentHrefs(shell("/dashboard/install"))).toEqual(["/dashboard/install"]);
    expect(currentHrefs(shell("/dashboard/devices/abc/edit"))).toEqual(["/dashboard/devices"]);
    expect(currentHrefs(shell("/dashboard/settings"))).toEqual([]); // Settings is not a nav item
    expect(currentHrefs(shell("/dashboard/children-old"))).toEqual([]); // prefix without "/" boundary
    expect(currentHrefs(shell("/dashboard/usage/42"))).toEqual([]);
  });

  it("acceptance: every ui.ts class is built from design tokens only", () => {
    const names = Object.keys(ui).filter((k) => typeof ui[k] === "string");
    expect(names.length).toBeGreaterThanOrEqual(20);
    for (const n of names) {
      for (const t of tokens(ui[n] ?? "")) {
        // Palette colours carry a shade (red-500); `red`, `green`, `amber` alone are design tokens.
        expect(t, `${n}: ${t}`).not.toMatch(/(^|:)(text|bg|border|ring|from|to|via|fill|stroke)-((neutral|slate|gray|zinc|stone|red|green|amber|yellow|blue|rose)-\d+|white|black)$/);
        expect(t, `${n}: ${t}`).not.toMatch(/^dark:/);
        expect(t, `${n}: ${t}`).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      }
    }
    // status pills carry the dark ink text, not the strong colour
    for (const n of ["pillGreen", "pillAmber", "pillRed", "pillAccent", "pillGrey"]) {
      expect(tokens(ui[n] ?? "")).toContain("text-ink");
    }
    expect(tokens(ui.alertError ?? "")).toContain("text-ink");
    expect(tokens(ui.alertWarning ?? "")).toContain("text-ink");
  });

  it("acceptance: tailwind theme maps every colour to an existing token", () => {
    const css = readFileSync(join(root, "apps/web/src/app/globals.css"), "utf8");
    const tokenCss = readFileSync(join(root, "apps/web/src/styles/tokens.css"), "utf8");
    const theme = css.match(/@theme inline\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    const mappings = [...theme.matchAll(/(--[\w-]+)\s*:\s*var\((--[\w-]+)\)/g)];
    expect(mappings.length).toBeGreaterThanOrEqual(8);
    for (const m of mappings) expect(tokenCss, m[2]).toContain(`${m[2]}:`);
    expect(theme).not.toContain("geist");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("acceptance: login shows no alert without an error and keeps a decorative icon", () => {
    const ok = renderToStaticMarkup(createElement(LoginForm, {}));
    expect(ok).not.toContain('role="alert"');
    expect(ok).toMatch(/<img[^>]*src="\/icon\.svg"[^>]*alt=""|<img[^>]*alt=""[^>]*src="\/icon\.svg"/);
    expect(ok).toContain("Continue with Google");
    expect(ok).not.toMatch(/neutral-|red-\d/);
  });

  it("acceptance: shell keeps destinations and renders the brand once in the header", () => {
    const html = shell("/dashboard/devices");
    expect(html).toContain('href="/dashboard/settings"');
    expect(html).toContain('action="/auth/sign-out"');
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain("Nguyen family");
    expect(html).not.toMatch(/neutral-|max-w-4xl\b.*max-w-4xl/);
  });

  it("acceptance: tokens file is the design source and layout drops Geist", () => {
    const a = readFileSync(join(root, "docs/design/tokens.css"));
    const b = readFileSync(join(root, "apps/web/src/styles/tokens.css"));
    expect(b.equals(a)).toBe(true);
    const layout = readFileSync(join(root, "apps/web/src/app/layout.tsx"), "utf8");
    expect(layout).toContain("Inter");
    expect(layout).not.toMatch(/geist/i);
  });
});
