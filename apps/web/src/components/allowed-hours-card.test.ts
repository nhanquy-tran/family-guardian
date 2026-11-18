import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AllowedHoursCard, type AllowedHoursCardProps } from "./allowed-hours-card";
import { buttonPrimary, card } from "./ui";

function render(overrides: Partial<AllowedHoursCardProps> = {}): string {
  const props: AllowedHoursCardProps = {
    childId: "c1",
    hours: { start: "07:00", end: "21:00" },
    error: null,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(AllowedHoursCard, props));
}

const inputs = (html: string) => html.match(/<input[^>]*>/g) ?? [];

describe("AllowedHoursCard", () => {
  it("Card markup", () => {
    const html = render();
    expect(html).toContain("Allowed hours");
    const times = inputs(html).filter((i) => i.includes('type="time"'));
    expect(times).toHaveLength(2);
    expect(times[0]).toContain('name="allowed_start"');
    expect(times[0]).toContain('value="07:00"');
    expect(times[1]).toContain('name="allowed_end"');
    expect(times[1]).toContain('value="21:00"');
    expect(inputs(html).some((i) => i.includes('type="hidden"') && i.includes('name="childId"') && i.includes('value="c1"'))).toBe(true);
    expect(html).toMatch(/empty/i);
    expect(html).toContain(card);
    expect(html).toContain(buttonPrimary);
    expect(html).not.toMatch(/\b(?:bg|text|border)-(?:slate|gray|zinc|red|blue|green)-\d{2,3}\b/);

    const empty = render({ hours: null, error: "invalid_hours" });
    const emptyTimes = inputs(empty).filter((i) => i.includes('type="time"'));
    expect(emptyTimes).toHaveLength(2);
    for (const tag of emptyTimes) expect(tag).not.toMatch(/value="[^"]+"/);
    expect(empty).toContain('role="alert"');
    expect(empty).toMatch(/start/i);
    expect(empty).toMatch(/end/i);
  });
});
