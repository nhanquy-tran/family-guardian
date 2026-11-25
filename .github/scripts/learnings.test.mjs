import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { describe, expect, it } from "vitest";

// pstack "Encode Lessons in Structure": a lesson counts only when code enforces it. From this date on,
// each factory-learnings row names at least one enforcing file that is not prose (test, script, workflow).
const FROM = "2026-11-25";
const ENFORCING = /\.(mjs|cjs|js|ts|tsx|sh|ya?ml|sql|json)$/;

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
const enforcingNames = new Set(files.filter((f) => ENFORCING.test(f)).flatMap((f) => [f, basename(f)]));

export function rows(markdown) {
  return markdown
    .split("\n")
    .filter((l) => /^\| \d{4}-\d{2}-\d{2} \|/.test(l))
    .map((l) => ({ date: l.slice(2, 12), rule: l.split("|").slice(-2, -1)[0] ?? "" }));
}

export function enforcedBy(rule) {
  return [...rule.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter((t) => enforcingNames.has(t) || enforcingNames.has(basename(t)));
}

const all = rows(readFileSync("docs/factory-learnings.md", "utf8"));

describe("factory learnings", () => {
  it("parses the table", () => {
    expect(all.length).toBeGreaterThan(30);
  });

  it.each(all.filter((r) => r.date >= FROM).map((r) => [r.date, r.rule]))("%s names an enforcing file", (_date, rule) => {
    expect(enforcedBy(rule), `rule names no test, script or workflow in backticks: ${rule.trim().slice(0, 120)}`).not.toEqual([]);
  });

  it("recognises prose-only rules", () => {
    expect(enforcedBy(" Reviewer posts with one command (`reviewer.md`). ")).toEqual([]);
    expect(enforcedBy(" Syntax test (`scripts-syntax.test.mjs`). ")).toEqual(["scripts-syntax.test.mjs"]);
  });
});
