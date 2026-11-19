import { describe, expect, it } from "vitest";
import { duplicateAdrNumbers, hotFiles, largeFiles, unindexedAdrs } from "./arch-facts.mjs";

describe("duplicateAdrNumbers", () => {
  it("finds two ADR files with the same number", () => {
    const files = ["0018-light-mode.md", "0018-weekly-report.md", "0019-waste.md", "README.md"];
    expect(duplicateAdrNumbers(files)).toEqual([{ number: "0018", files: ["0018-light-mode.md", "0018-weekly-report.md"] }]);
  });

  it("returns nothing when numbers are unique", () => {
    expect(duplicateAdrNumbers(["0001-a.md", "0002-b.md"])).toEqual([]);
  });
});

describe("unindexedAdrs", () => {
  it("lists ADR files the README index does not link", () => {
    const readme = "| [0001](0001-a.md) | A |\n| [0002](0002-b.md) | B |\n";
    expect(unindexedAdrs(["0001-a.md", "0002-b.md", "0003-c.md", "README.md"], readme)).toEqual(["0003-c.md"]);
  });
});

describe("hotFiles", () => {
  const log = ["apps/web/src/a.ts", "package-lock.json", "", "apps/web/src/a.ts", "docs/x.md", "", "apps/web/src/a.ts", "docs/x.md", "openspec/changes/archive/z/tasks.md", "docs/reports/r.html", ""].join("\n");

  it("counts commits per file, most changed first, without lockfiles, archives and reports", () => {
    expect(hotFiles(log, 5)).toEqual([{ path: "apps/web/src/a.ts", commits: 3 }, { path: "docs/x.md", commits: 2 }]);
  });

  it("keeps only the top n", () => {
    expect(hotFiles(log, 1)).toEqual([{ path: "apps/web/src/a.ts", commits: 3 }]);
  });
});

describe("largeFiles", () => {
  it("lists source files over the limit, largest first, without tests", () => {
    const entries = [
      { path: "apps/web/src/big.ts", lines: 500 },
      { path: "apps/web/src/bigger.tsx", lines: 900 },
      { path: "apps/web/src/big.test.ts", lines: 1200 },
      { path: "apps/web/src/small.ts", lines: 100 },
      { path: "docs/long.md", lines: 2000 },
    ];
    expect(largeFiles(entries, 400)).toEqual([{ path: "apps/web/src/bigger.tsx", lines: 900 }, { path: "apps/web/src/big.ts", lines: 500 }]);
  });
});
