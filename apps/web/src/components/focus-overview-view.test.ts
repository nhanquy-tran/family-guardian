import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ChildFocus, TrendDay } from "../lib/focus-overview";
import { FocusOverviewView } from "./focus-overview-view";

const DAYS = ["2026-03-08", "2026-03-09", "2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14"];
const SCORES = [41, 52, 63, 34, 85, 96, 72];

const trend = (scores: (number | null)[] = SCORES): TrendDay[] => DAYS.map((day, i) => ({ day, score: scores[i] ?? null }));

function child(over: Partial<ChildFocus> = {}): ChildFocus {
  return {
    id: "c1",
    name: "Minh",
    categories: ["education"],
    extraDomains: [],
    result: {
      today: { score: 72, homeworkSeconds: 3900, otherSeconds: 1500, totalSeconds: 5400, switches: 4 },
      trend: trend(),
    },
    ...over,
  };
}

const render = (items: ChildFocus[]) => renderToStaticMarkup(createElement(FocusOverviewView, { items }));
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("FocusOverviewView", () => {
  it("Score, times and trend", () => {
    const html = render([child()]);
    const t = text(html);
    expect(t).toContain("Minh");
    expect(t).toContain("1 h 05 min"); // 3900 s = 65 min
    expect(t).toContain("25 min"); // 1500 s
    expect(t).toMatch(/\b4\b/);
    expect(t).toMatch(/\b72\b/);
    const items = html.match(/<li[\s>]/g) ?? [];
    expect(items).toHaveLength(7); // the 7 trend items are the only list items
    for (const score of SCORES) expect(t, String(score)).toContain(String(score));
  });

  it("Days without data", () => {
    const html = render([
      child({
        result: {
          today: { score: null, homeworkSeconds: 0, otherSeconds: 0, totalSeconds: 0, switches: 0 },
          trend: trend([null, null, null, null, null, null, null]),
        },
      }),
    ]);
    const t = text(html);
    expect(t).toContain("No activity");
    expect((t.match(/no data/gi) ?? []).length).toBeGreaterThanOrEqual(7);
    expect(t).not.toMatch(/(^|[^\d-])0(?![\d-])\s*(\/|%|points)/);
    expect(t).not.toMatch(/\bscore\W+0\b/i);
  });

  it("Homework not configured", () => {
    const html = render([
      child({ id: "c9", name: "Lan", categories: [], extraDomains: [], result: {
        today: { score: 88, homeworkSeconds: 100, otherSeconds: 100, totalSeconds: 200, switches: 0 },
        trend: trend([88, 88, 88, 88, 88, 88, 88]),
      } }),
    ]);
    expect(html).toContain('href="/dashboard/children/c9/homework"');
    expect(text(html)).not.toContain("88");
  });

  it("Explanation", () => {
    const t = text(render([child()]));
    expect(t).toMatch(/share of .*time.*homework/i);
    expect(t).toMatch(/20 points/i);
    expect(t).toMatch(/switch/i);
    expect(t).toMatch(/no score.*activity|without activity/i);
  });

  it("Error state", () => {
    const html = render([child({ id: "bad", name: "Broken", result: { error: true } }), child({ id: "good", name: "Fine" })]);
    const t = text(html);
    expect(t).toContain("Could not load");
    expect(t).toContain("Broken");
    expect(t).toContain("Fine");
    expect(t).toContain("1 h 05 min"); // the other card still renders its values
    expect((t.match(/1 h 05 min/g) ?? []).length).toBe(1); // none for the failed card
    expect((html.match(/<li[\s>]/g) ?? []).length).toBe(7); // trend only for the healthy card
  });

  it("No children", () => {
    const html = render([]);
    expect(html).toContain('href="/dashboard/children"');
  });
});
