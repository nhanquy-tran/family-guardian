import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DASHBOARD_NAV, DashboardShell } from "./dashboard-shell";

function render() {
  return renderToStaticMarkup(
    createElement(DashboardShell, { familyName: "Tran family", children: "page body" }),
  );
}

describe("DashboardShell", () => {
  it("header shows family name and sign-out", () => {
    const html = render();
    expect(html).toContain("Tran family");
    expect(html).toContain("page body");
    const form = html.match(/<form[^>]*>[\s\S]*?<\/form>/)?.[0] ?? "";
    expect(form).toMatch(/method="post"/);
    expect(form).toMatch(/action="\/auth\/sign-out"/);
    expect(form).toMatch(/<button[^>]*>\s*Sign out\s*<\/button>/);
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
    const nav = html.match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(nav).not.toBe("");
    const hrefs = [...nav.matchAll(/<a[^>]*\shref="([^"]*)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/dashboard", "/dashboard/children", "/dashboard/devices", "/dashboard/install"]);
  });

  it("nav targets exist", () => {
    const dir = fileURLToPath(new URL("../app/dashboard", import.meta.url));
    for (const page of ["page.tsx", "children/page.tsx", "devices/page.tsx", "install/page.tsx"]) {
      expect(existsSync(join(dir, page)), page).toBe(true);
    }
  });
});
