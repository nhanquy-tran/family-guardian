import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DASHBOARD_NAV, DashboardShell } from "./dashboard-shell";
import * as ui from "./ui";

const u = ui as Record<string, string>;
const here = dirname(fileURLToPath(import.meta.url));
const tokens = (s: string | undefined): string[] => (s ?? "").split(/\s+/).filter(Boolean);
const classesOf = (tag: string): string[] => tokens(tag.match(/class="([^"]*)"/)?.[1]);

function render(currentPath?: string): string {
  return renderToStaticMarkup(
    createElement(DashboardShell, { familyName: "Tran family", ...(currentPath ? { currentPath } : {}) }, "page body"),
  );
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

  it("header shows the brand", () => {
    const header = render().match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(header).toMatch(/<img[^>]*src="\/icon\.svg"/);
    expect(header).toContain("Family Guardian");
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
    const dashboard = join(here, "..", "app", "dashboard");
    for (const p of ["page.tsx", "children/page.tsx", "devices/page.tsx", "install/page.tsx"]) {
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
    expect(u.buttonSecondary).toBeTruthy();
    const button = classesOf(header.match(/<button[^>]*>/)?.[0] ?? "");
    for (const c of tokens(u.buttonSecondary)) expect(button).toContain(c);
  });

  it("nav is horizontal and wraps", () => {
    const nav = render().match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? "";
    const classes = classesOf(nav.match(/<nav[^>]*>/)?.[0] ?? "");
    expect(classes).toContain("flex");
    expect(classes).toContain("flex-wrap");
    const links = nav.match(/<a[^>]*>/g) ?? [];
    expect(links).toHaveLength(DASHBOARD_NAV.length);
    expect(u.navLink).toBeTruthy();
    for (const link of links) for (const c of tokens(u.navLink)) expect(classesOf(link)).toContain(c);
    const hrefs = [...nav.matchAll(/<a[^>]*href="([^"]*)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(DASHBOARD_NAV.map((n) => n.href));
  });

  const currentHrefs = (path?: string): string[] => {
    const nav = render(path).match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? "";
    return (nav.match(/<a[^>]*>/g) ?? [])
      .filter((a) => a.includes('aria-current="page"'))
      .map((a) => a.match(/href="([^"]*)"/)?.[1] ?? "");
  };

  it("current page is highlighted", () => {
    expect(currentHrefs("/dashboard/devices")).toEqual(["/dashboard/devices"]);
    const nav = render("/dashboard/devices").match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? "";
    const links = nav.match(/<a[^>]*>/g) ?? [];
    const current = links.find((a) => a.includes('aria-current="page"')) ?? "";
    expect(u.navLinkCurrent).toBeTruthy();
    for (const c of tokens(u.navLinkCurrent)) expect(classesOf(current)).toContain(c);
    for (const other of links.filter((a) => !a.includes("aria-current"))) {
      expect(classesOf(other)).not.toContain("bg-accent-soft");
    }
  });

  it("sub-paths highlight their section", () => {
    expect(currentHrefs("/dashboard/children/123")).toEqual(["/dashboard/children"]);
    expect(currentHrefs("/dashboard/install")).toEqual(["/dashboard/install"]);
    expect(currentHrefs("/dashboard")).toEqual(["/dashboard"]);
  });

  it("no current page", () => {
    expect(render()).not.toContain("aria-current");
  });

  it("nav reads the path on the client", () => {
    const src = (rel: string): string => readFileSync(join(here, rel), "utf8");
    expect(src("../app/dashboard/layout.tsx")).not.toContain("currentPath");
    const nav = src("dashboard-nav.tsx");
    expect(nav.trimStart()).toMatch(/^["']use client["']/);
    expect(nav).toContain("usePathname");
  });

  it("page container", () => {
    const html = render();
    const classes = classesOf(html.match(/^<div[^>]*>/)?.[0] ?? "");
    expect(u.container).toBeTruthy();
    for (const c of tokens(u.container)) expect(classes).toContain(c);
    expect(html).toMatch(/<main[^>]*>[\s\S]*page body[\s\S]*<\/main>/);
  });
});
