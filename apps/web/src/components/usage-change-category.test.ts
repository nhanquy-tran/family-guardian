import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UsageView } from "../app/dashboard/usage/[childId]/usage-view";

const here = dirname(fileURLToPath(import.meta.url));
const TODAY = "2026-03-14";

function result(domains: string[]) {
  return {
    status: "ok" as const,
    days: domains.map((domain, i) => ({ day: TODAY, domain, seconds: 120 + (domains.length - i) * 60 })),
    timeline: [],
    overrides: {},
  };
}

const render = (domains: string[], view: "today" | "week") =>
  renderToStaticMarkup(createElement(UsageView, { result: result(domains), view, tz: "UTC", today: TODAY }));

const anchors = (html: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ attrs: m[1] ?? "", text: m[2] ?? "" }));

describe("Change category from top sites", () => {
  it("Top sites link to the categories form", () => {
    for (const view of ["today", "week"] as const) {
      const html = render(["youtube.com", "docs.google.com"], view);
      const hrefs = anchors(html)
        .filter((a) => a.text.trim() === "Change category")
        .map((a) => a.attrs.match(/href="([^"]*)"/)?.[1]);
      expect(hrefs, view).toEqual([
        "/dashboard/categories?domain=youtube.com",
        "/dashboard/categories?domain=docs.google.com",
      ]);
    }
  });

  it("No sites, no links", () => {
    const html = render([], "today");
    expect(html).toContain("No activity yet.");
    expect(html).not.toContain("Change category");
  });

  it("Top sites row wraps at 375 px", () => {
    const html = render(["youtube.com"], "today");
    const row = html.match(/<li[^>]*>(?:(?!<\/li>)[\s\S])*youtube\.com[\s\S]*?<\/li>/)?.[0] ?? "";
    expect(row.match(/<li[^>]*class="([^"]*)"/)?.[1]?.split(/\s+/)).toContain("flex-wrap");
    const source = readFileSync(join(here, "..", "app", "dashboard", "usage", "[childId]", "usage-view.tsx"), "utf8");
    for (const banned of ["w-[", "min-w-[", "whitespace-nowrap"]) expect(source).not.toContain(banned);
  });
});
