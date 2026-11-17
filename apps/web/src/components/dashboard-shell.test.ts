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

  const classesOf = (tag: string): string[] => (tag.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/).filter(Boolean);

  it("header", () => {
    const header = render().match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0] ?? "";
    const classes = classesOf(header.match(/<header[^>]*>/)?.[0] ?? "");
    expect(classes).toContain("flex");
    expect(classes).toContain("items-center");
    expect(header).toContain("Tran family");
    expect(header).toContain('action="/auth/sign-out"');
    expect(header).toContain('method="post"');
    expect(classesOf(header.match(/<button[^>]*>/)?.[0] ?? "")).toContain("min-h-10");
  });

  it("nav is horizontal and wraps", () => {
    const nav = render().match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? "";
    const classes = classesOf(nav.match(/<nav[^>]*>/)?.[0] ?? "");
    expect(classes).toContain("flex");
    expect(classes).toContain("flex-wrap");
    const links = nav.match(/<a[^>]*>/g) ?? [];
    expect(links).toHaveLength(DASHBOARD_NAV.length);
    for (const link of links) {
      expect(classesOf(link).some((c) => /^(p|px|py)-\d/.test(c))).toBe(true);
    }
    const hrefs = [...nav.matchAll(/<a[^>]*href="([^"]*)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(DASHBOARD_NAV.map((n) => n.href));
  });

  it("page container", () => {
    const html = render();
    const classes = classesOf(html.match(/^<div[^>]*>/)?.[0] ?? "");
    for (const c of ["mx-auto", "max-w-4xl", "p-4", "sm:p-6"]) expect(classes).toContain(c);
    expect(html).toMatch(/<main[^>]*>[\s\S]*page body[\s\S]*<\/main>/);
  });
});
