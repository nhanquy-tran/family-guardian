import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WeeklyReportForm } from "./weekly-report-form";

const render = (enabled: boolean): string =>
  renderToStaticMarkup(createElement(WeeklyReportForm, { enabled, action: async () => undefined }));

const checkbox = (html: string): string => {
  const tags = (html.match(/<input[^>]*>/g) ?? []).filter((t) => t.includes('type="checkbox"'));
  expect(tags).toHaveLength(1);
  return tags[0] as string;
};

const isChecked = (tag: string): boolean => /\schecked(=|\s|\/|>)/.test(tag);

/** The label text is tied to the checkbox by `for`/`id` or by wrapping it. */
function labelled(html: string, tag: string): boolean {
  const id = /\sid="([^"]+)"/.exec(tag)?.[1];
  const labels = html.match(/<label[^>]*>[\s\S]*?<\/label>/g) ?? [];
  return labels.some((l) => {
    if (!l.includes("Weekly report")) return false;
    return l.includes(tag) || (id !== undefined && new RegExp(`\\sfor="${id}"`).test(l));
  });
}

describe("WeeklyReportForm", () => {
  it("Form rendering", () => {
    const off = render(false);
    const offBox = checkbox(off);
    expect(isChecked(offBox)).toBe(false);
    expect(labelled(off, offBox)).toBe(true);

    const on = render(true);
    const onBox = checkbox(on);
    expect(isChecked(onBox)).toBe(true);
    expect(labelled(on, onBox)).toBe(true);

    for (const html of [off, on]) {
      expect(html).toContain("Monday");
      expect(html).toMatch(/all parents/i);
      expect(html).toMatch(/<button[^>]*type="submit"|<input[^>]*type="submit"/);
    }
  });
});
