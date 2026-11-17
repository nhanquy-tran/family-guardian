import { CATEGORIES } from "@fg/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeworkSettingsView, type HomeworkSettingsViewProps } from "./homework-settings-view";

function render(overrides: Partial<HomeworkSettingsViewProps> = {}): string {
  const props: HomeworkSettingsViewProps = {
    childId: "child-42",
    childName: "Minh",
    categories: ["education"],
    extraDomains: ["a.org"],
    error: null,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(HomeworkSettingsView, props));
}

const forms = (html: string) => html.match(/<form[\s\S]*?<\/form>/g) ?? [];

describe("HomeworkSettingsView", () => {
  it("Current settings shown", () => {
    const html = render();
    const checkboxes = [...html.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)].map((m) => m[0]);
    expect(checkboxes).toHaveLength(CATEGORIES.length);
    expect(CATEGORIES).toHaveLength(9);
    for (const category of CATEGORIES) {
      const box = checkboxes.find((c) => c.includes(`value="${category}"`));
      expect(box, category).toBeDefined();
      expect(/\bchecked(=|\s|\/|>)/.test(box ?? ""), category).toBe(category === "education");
    }

    const removeForms = forms(html).filter((f) => f.includes("a.org"));
    expect(removeForms).toHaveLength(1);
    expect(removeForms[0]).toMatch(/<button/);

    const allForms = forms(html);
    expect(allForms.length).toBeGreaterThanOrEqual(3); // categories, add domain, remove domain
    for (const form of allForms) expect(form, "form carries the child id").toContain("child-42");
  });

  it("Error message", () => {
    expect(render({ error: "duplicate" })).toMatch(/already in the list/i);
    expect(render({ error: null })).not.toMatch(/already in the list/i);
  });
});
