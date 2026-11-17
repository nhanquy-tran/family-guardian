import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DASHBOARD_NAV, DashboardShell } from "./dashboard-shell";

function render(): string {
  return renderToStaticMarkup(createElement(DashboardShell, { familyName: "Tran family" }, "page body"));
}

describe("DashboardShell", () => {
  it("header shows family name and sign-out", () => {
    const html = render();
    expect(html).toContain("Tran family");
    expect(html).toContain("page body");
    const form = html.match(/<form[^>]*>[\s\S]*?<\/form>/);
    expect(form).not.toBeNull();
    const markup = form?.[0] ?? "";
    expect(markup).toContain('method="post"');
    expect(markup).toContain('action="/auth/sign-out"');
    expect(markup).toMatch(/<button[^>]*>\s*Sign out\s*<\/button>/);
  });

  it("nav items are fixed", () => {
    expect(DASHBOARD_NAV).toEqual([
      { label: "Overview", href: "/dashboard" },
      { label: "Children", href: "/dashboard/children" },
      { label: "Devices", href: "/dashboard/devices" },
      { label: "Install", href: "/dashboard/install" },
    ]);
  });

  it("nav renders as links", () => {
    const html = render();
    const nav = html.match(/<nav[\s\S]*?<\/nav>/);
    expect(nav).not.toBeNull();
    const hrefs = [...(nav?.[0] ?? "").matchAll(/<a[^>]*href="([^"]*)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/dashboard", "/dashboard/children", "/dashboard/devices", "/dashboard/install"]);
  });

  it("nav targets exist", () => {
    const dashboard = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "dashboard");
    for (const p of ["page.tsx", "children/page.tsx", "devices/page.tsx", "install/page.tsx"]) {
      expect(existsSync(join(dashboard, p)), p).toBe(true);
    }
  });
});
