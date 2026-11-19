import { CATEGORIES } from "@fg/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DailyLimitsCard, type DailyLimitsCardProps } from "./daily-limits-card";
import { buttonPrimary, card } from "./ui";

function render(overrides: Partial<DailyLimitsCardProps> = {}): string {
  const props: DailyLimitsCardProps = {
    childId: "c1",
    limits: [{ category: "games", minutesPerDay: 60 }],
    error: null,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(DailyLimitsCard, props));
}

const inputs = (html: string) => html.match(/<input[^>]*>/g) ?? [];

describe("DailyLimitsCard", () => {
  it("Inputs for every category", () => {
    const html = render();
    expect(html).toContain("Daily limits");
    const numbers = inputs(html).filter((i) => i.includes('type="number"'));
    expect(numbers).toHaveLength(CATEGORIES.length);
    CATEGORIES.forEach((category, index) => {
      const tag = numbers[index];
      expect(tag).toContain(`name="limit_${category}"`);
      expect(tag).toContain('min="5"');
      expect(tag).toContain('max="1440"');
      if (category === "games") expect(tag).toContain('value="60"');
      else expect(tag).not.toMatch(/value="[^"]+"/);
    });
    expect(inputs(html).some((i) => i.includes('type="hidden"') && i.includes('name="childId"') && i.includes('value="c1"'))).toBe(true);
  });

  it("Error messages", () => {
    const invalid = render({ error: "invalid_minutes" });
    expect(invalid).toContain('role="alert"');
    expect(invalid).toContain("5");
    expect(invalid).toContain("1440");
    const failed = render({ error: "failed" });
    expect(failed).toContain('role="alert"');
    expect(failed).toMatch(/could not be loaded or saved/i);
  });

  it("Only ui.ts styles", () => {
    const html = render();
    expect(html).toContain(card);
    expect(html).toContain(buttonPrimary);
    expect(html).not.toMatch(/\b(bg-blue-|text-gray-)/);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("Clearing limits of a child the parent cannot see", () => {
    const html = render({ error: "not_found" });
    expect(html).toContain('role="alert"');
    expect(html).toContain("This child was not found. Reload the page and try again.");
  });
});
