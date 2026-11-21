import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionForm } from "./action-form";
import { LoadingOverlay } from "./loading-overlay";
import { isPageChange, shouldShowForClick } from "./navigation-overlay";

const here = dirname(fileURLToPath(import.meta.url));
const current = new URL("https://app.test/dashboard/children?tz=Asia%2FHo_Chi_Minh");
const plainClick = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
const link = (href: string, extra: Partial<{ target: string; download: boolean }> = {}) => ({
  href: new URL(href, current).href,
  target: extra.target ?? "",
  download: extra.download ?? false,
});

describe("LoadingOverlay", () => {
  it("covers the screen, blocks clicks and announces loading", () => {
    const html = renderToStaticMarkup(createElement(LoadingOverlay));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Loading");
    expect(html).toMatch(/class="[^"]*\bfixed\b[^"]*\binset-0\b/);
    expect(html).toContain("animate-spin");
  });
});

describe("shouldShowForClick", () => {
  it("shows for a plain click on a link to another dashboard page", () => {
    expect(shouldShowForClick(plainClick, link("/dashboard/devices"), current)).toBe(true);
  });

  it("shows when only the query changes", () => {
    expect(shouldShowForClick(plainClick, link("/dashboard/children?confirmDelete=1"), current)).toBe(true);
  });

  it("does not show for the same page or a hash on it", () => {
    expect(shouldShowForClick(plainClick, link(current.href), current)).toBe(false);
    expect(shouldShowForClick(plainClick, link(`${current.pathname}${current.search}#top`), current)).toBe(false);
  });

  it("does not show for new tabs, downloads, other sites or modified clicks", () => {
    expect(shouldShowForClick(plainClick, link("/dashboard/devices", { target: "_blank" }), current)).toBe(false);
    expect(shouldShowForClick(plainClick, link("/firefox/a.xpi", { download: true }), current)).toBe(false);
    expect(shouldShowForClick(plainClick, link("https://chrome.google.com/webstore"), current)).toBe(false);
    expect(shouldShowForClick({ ...plainClick, metaKey: true }, link("/dashboard/devices"), current)).toBe(false);
    expect(shouldShowForClick({ ...plainClick, ctrlKey: true }, link("/dashboard/devices"), current)).toBe(false);
    expect(shouldShowForClick({ ...plainClick, button: 1 }, link("/dashboard/devices"), current)).toBe(false);
  });
});

describe("isPageChange", () => {
  it("compares path and query, not hash", () => {
    expect(isPageChange("/a?x=1", "/a?x=1")).toBe(false);
    expect(isPageChange("/a?x=1", "/a?x=2")).toBe(true);
    expect(isPageChange("/a", "/b")).toBe(true);
  });
});

describe("ActionForm", () => {
  it("renders a plain form with its children and no overlay while idle", () => {
    const html = renderToStaticMarkup(
      createElement(ActionForm, { action: "/somewhere", className: "x" }, createElement("button", null, "Save")),
    );
    expect(html).toMatch(/^<form[^>]*class="x"/);
    expect(html).toContain("<button>Save</button>");
    expect(html).not.toContain('role="status"');
  });

  it("is used for every server-action form of the dashboard", () => {
    const files = [
      "../app/dashboard/settings/page.tsx",
      "../app/dashboard/children/[childId]/rules/page.tsx",
      "block-rules-view.tsx",
      "allowed-hours-card.tsx",
      "children-list.tsx",
      "homework-settings-view.tsx",
      "device-list.tsx",
      "category-overrides-view.tsx",
      "weekly-report-form.tsx",
      "daily-limits-card.tsx",
    ];
    for (const file of files) {
      const src = readFileSync(join(here, file), "utf8");
      expect(src, file).not.toMatch(/<form\s+[^>]*action=\{/);
    }
  });

  it("the dashboard shell mounts the navigation overlay", () => {
    const src = readFileSync(join(here, "dashboard-shell.tsx"), "utf8");
    expect(src).toContain("<NavigationOverlay />");
  });
});
