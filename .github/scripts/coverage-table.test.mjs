import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { areaRows, parseThresholds, toMarkdown } from "./coverage-table.mjs";

const CONFIG = `
      thresholds: {
        autoUpdate: (value: number) => Math.floor(value),
        lines: 79,
        branches: 73,
        "packages/shared/src/**": { lines: 99, branches: 89 },
        "apps/web/src/app/**": { lines: 30, branches: 13 },
      },`;

const metric = (covered, total) => ({ covered, total, skipped: 0, pct: total ? (100 * covered) / total : 100 });
const file = (lines, branches) => ({ lines: metric(...lines), branches: metric(...branches), statements: metric(0, 0), functions: metric(0, 0) });

const ROOT = "/repo";
const SUMMARY = {
  total: file([70, 100], [30, 40]),
  "/repo/packages/shared/src/a.ts": file([50, 50], [9, 10]),
  "/repo/apps/web/src/app/page.tsx": file([10, 40], [1, 20]),
  "/repo/apps/web/src/app/x/actions.ts": file([10, 10], [2, 10]),
};

describe("parseThresholds", () => {
  it("reads the global and per-area thresholds from the config text", () => {
    expect(parseThresholds(CONFIG)).toEqual([
      { area: "all", lines: 79, branches: 73 },
      { area: "packages/shared/src/**", lines: 99, branches: 89 },
      { area: "apps/web/src/app/**", lines: 30, branches: 13 },
    ]);
  });

  it("matches the thresholds in the real vitest config", () => {
    const areas = parseThresholds(readFileSync("vitest.config.ts", "utf8")).map((t) => t.area);
    expect(areas[0]).toBe("all");
    expect(areas.length).toBeGreaterThan(1);
  });
});

describe("areaRows", () => {
  it("adds up each area's files and compares them with the threshold", () => {
    const rows = areaRows(SUMMARY, parseThresholds(CONFIG), ROOT);
    expect(rows).toEqual([
      { area: "all", lines: 70, branches: 75, min: "79 / 73", ok: false },
      { area: "packages/shared/src/**", lines: 100, branches: 90, min: "99 / 89", ok: true },
      { area: "apps/web/src/app/**", lines: 40, branches: 10, min: "30 / 13", ok: false },
    ]);
  });

  it("handles Windows paths in the summary", () => {
    const rows = areaRows({ total: SUMMARY.total, "C:\\repo\\packages\\shared\\src\\a.ts": file([1, 2], [1, 1]) }, parseThresholds(CONFIG), "C:\\repo");
    expect(rows[1]).toMatchObject({ area: "packages/shared/src/**", lines: 50 });
  });
});

describe("toMarkdown", () => {
  it("renders one row per area with a pass or below-threshold mark", () => {
    const md = toMarkdown([
      { area: "all", lines: 79.54, branches: 73.68, min: "79 / 73", ok: true },
      { area: "apps/web/src/app/**", lines: 20, branches: 5, min: "30 / 13", ok: false },
    ]);
    expect(md).toContain("| Area | Lines % | Branches % | Minimum (lines / branches) | |");
    expect(md).toContain("| all | 79.5 | 73.7 | 79 / 73 | pass |");
    expect(md).toContain("| `apps/web/src/app/**` | 20.0 | 5.0 | 30 / 13 | **below** |");
  });
});
