import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DASHBOARD_NAV, DashboardShell } from "./dashboard-shell";
import * as uiModule from "./ui";

const ui = uiModule as unknown as Record<string, string>;
const here = dirname(fileURLToPath(import.meta.url));

function render(currentPath?: string): string {
  return renderToStaticMarkup(
    createElement(DashboardShell, { familyName: "Tran family", ...(currentPath ? { currentPath } : {}) }, "page body"),
  );
}

const tokens = (s: string): string[] => s.split(/\s+/).filter(Boolean);
const classesOf = (tag: string): string[] => tokens(tag.match(/class="([^"]*)"/)?.[1] ?? "");
const navLinks = (html: string): string[] => (html.match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? "").match(/<a[^>]*>/g) ?? [];
const hrefOf = (tag: string): string => tag.match(/href="([^"]*)"/)?.[1] ?? "";
const currentHrefs = (html: string): string[] => navLinks(html).filter((l) => l.includes("aria-current")).map(hrefOf);

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

  it("header shows the brand", () => {
    const header = render().match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(header).toMatch(/<img[^>]*src="\/icon\.svg"/);
    expect(header).toContain("Family Guardian");
  });

  it("nav items are fixed", () => {
    expect(DASHBOARD_NAV).toEqual([
      { label: "Overview", href: "/dashboard" },
      { label: "Children", href: "/dashboard/children" },
      { label: "Categories", href: "/dashboard/categories" },
      { label: "Devices", href: "/dashboard/devices" },
      { label: "Install", href: "/dashboard/install" },
    ]);
  });

  it("nav renders as links", () => {
    const html = render();
    const nav = html.match(/<nav[\s\S]*?<\/nav>/);
    expect(nav).not.toBeNull();
    const hrefs = [...(nav?.[0] ?? "").matchAll(/<a[^>]*href="([^"]*)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual([
      "/dashboard",
      "/dashboard/children",
      "/dashboard/categories",
      "/dashboard/devices",
      "/dashboard/install",
    ]);
  });

  it("nav targets exist", () => {
    const dashboard = join(here, "..", "app", "dashboard");
    for (const p of ["page.tsx", "children/page.tsx", "categories/page.tsx", "devices/page.tsx", "install/page.tsx"]) {
      expect(existsSync(join(dashboard, p)), p).toBe(true);
    }
  });

  it("header", () => {
    const header = render().match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0] ?? "";
    const classes = classesOf(header.match(/<header[^>]*>/)?.[0] ?? "");
    expect(classes).toContain("sticky");
    expect(classes).toContain("flex");
    expect(header).toMatch(/<img[^>]*src="\/icon\.svg"/);
    expect(header).toContain("Family Guardian");
    expect(header).toContain("Tran family");
    expect(header).toContain('action="/auth/sign-out"');
    expect(header).toContain('method="post"');
    expect(ui.buttonSecondary).toBeTruthy();
    const buttonClasses = classesOf(header.match(/<button[^>]*>/)?.[0] ?? "");
    for (const c of tokens(ui.buttonSecondary ?? "")) expect(buttonClasses).toContain(c);
  });

  it("nav is horizontal and wraps", () => {
    const html = render();
    const nav = html.match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? "";
    const classes = classesOf(nav.match(/<nav[^>]*>/)?.[0] ?? "");
    expect(classes).toContain("flex");
    expect(classes).toContain("flex-wrap");
    const links = navLinks(html);
    expect(links).toHaveLength(DASHBOARD_NAV.length);
    expect(ui.navLink).toBeTruthy();
    for (const link of links) {
      for (const c of tokens(ui.navLink ?? "")) expect(classesOf(link)).toContain(c);
    }
    expect(links.map(hrefOf)).toEqual(DASHBOARD_NAV.map((n) => n.href));
  });

  it("current page is highlighted", () => {
    const html = render("/dashboard/devices");
    expect(currentHrefs(html)).toEqual(["/dashboard/devices"]);
    const current = navLinks(html).find((l) => hrefOf(l) === "/dashboard/devices") ?? "";
    expect(current).toContain('aria-current="page"');
    expect(ui.navLinkCurrent).toBeTruthy();
    for (const c of tokens(ui.navLinkCurrent ?? "")) expect(classesOf(current)).toContain(c);
  });

  it("sub-paths highlight their section", () => {
    expect(currentHrefs(render("/dashboard/children/123"))).toEqual(["/dashboard/children"]);
    expect(currentHrefs(render("/dashboard"))).toEqual(["/dashboard"]);
  });

  it("no current page", () => {
    expect(render()).not.toContain("aria-current");
  });

  it("nav reads the path on the client", () => {
    const layout = readFileSync(join(here, "..", "app", "dashboard", "layout.tsx"), "utf8");
    expect(layout).not.toContain("currentPath");
    const nav = readFileSync(join(here, "dashboard-nav.tsx"), "utf8");
    expect(nav).toMatch(/^\s*(["'])use client\1/);
    expect(nav).toMatch(/usePathname\s*\(/);
  });

  it("page container", () => {
    const html = render();
    const classes = classesOf(html.match(/^<div[^>]*>/)?.[0] ?? "");
    expect(ui.container).toBeTruthy();
    for (const c of tokens(ui.container ?? "")) expect(classes).toContain(c);
    expect(html).toMatch(/<main[^>]*>[\s\S]*page body[\s\S]*<\/main>/);
  });
});
