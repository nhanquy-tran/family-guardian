import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lintChange } from "./spec-lint.mjs";

let root;
const put = (path, text) => {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
};
const scenario = (title) => `#### Scenario: ${title}\n- **GIVEN** a parent\n- **WHEN** it happens\n- **THEN** it works\n`;
const requirement = (name, scenarios = 1) =>
  `### Requirement: ${name}\nThe system SHALL do it.\n\n${Array.from({ length: scenarios }, (_, i) => scenario(`${name} ${i + 1}`)).join("\n")}\n`;
const proposal = (touches, depends = "none") => `Depends on: ${depends}\nTouches: ${touches}\n\n## Why\nBecause.\n`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "spec-lint-"));
  put("openspec/specs/daily-limits/spec.md", `# daily-limits Specification\n\n## Purpose\nLimits.\n\n## Requirements\n\n${requirement("Limits are stored per child")}`);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("lintChange", () => {
  it("passes a change that modifies an existing requirement and lists its capability", () => {
    put("openspec/changes/a/proposal.md", proposal("daily-limits"));
    put("openspec/changes/a/specs/daily-limits/spec.md", `## MODIFIED Requirements\n\n${requirement("Limits are stored per child")}`);
    const r = lintChange({ root, change: "a" });
    expect(r.problems).toEqual([]);
    expect(r.scenarios).toBe(1);
  });

  it("flags a missing Depends on or Touches line", () => {
    put("openspec/changes/a/proposal.md", "## Why\nBecause.\n");
    put("openspec/changes/a/specs/daily-limits/spec.md", `## ADDED Requirements\n\n${requirement("New thing")}`);
    const r = lintChange({ root, change: "a" });
    expect(r.problems).toContain("proposal.md has no `Depends on:` line");
    expect(r.problems).toContain("proposal.md has no `Touches:` line");
  });

  it("flags ADDED for a requirement that already exists", () => {
    put("openspec/changes/a/proposal.md", proposal("daily-limits"));
    put("openspec/changes/a/specs/daily-limits/spec.md", `## ADDED Requirements\n\n${requirement("limits are stored per child")}`);
    expect(lintChange({ root, change: "a" }).problems).toContain(
      'daily-limits: "limits are stored per child" already exists; use MODIFIED',
    );
  });

  it("flags MODIFIED or REMOVED for a requirement that does not exist", () => {
    put("openspec/changes/a/proposal.md", proposal("daily-limits"));
    put("openspec/changes/a/specs/daily-limits/spec.md", `## MODIFIED Requirements\n\n${requirement("Ghost")}\n## REMOVED Requirements\n\n### Requirement: Phantom\n`);
    const { problems } = lintChange({ root, change: "a" });
    expect(problems).toContain('daily-limits: MODIFIED "Ghost" does not exist in openspec/specs');
    expect(problems).toContain('daily-limits: REMOVED "Phantom" does not exist in openspec/specs');
  });

  it("requires a Purpose for a new capability", () => {
    put("openspec/changes/a/proposal.md", proposal("weekly-report"));
    put("openspec/changes/a/specs/weekly-report/spec.md", `## ADDED Requirements\n\n${requirement("Send it")}`);
    expect(lintChange({ root, change: "a" }).problems).toContain("weekly-report: new capability needs a `## Purpose` section");
    put("openspec/changes/a/specs/weekly-report/spec.md", `## Purpose\nWeekly mail.\n\n## ADDED Requirements\n\n${requirement("Send it")}`);
    expect(lintChange({ root, change: "a" }).problems).toEqual([]);
  });

  it("requires every delta capability in Touches and every Touches capability to exist", () => {
    put("openspec/changes/a/proposal.md", proposal("web-ui, packages/shared/src/index.ts"));
    put("openspec/changes/a/specs/daily-limits/spec.md", `## MODIFIED Requirements\n\n${requirement("Limits are stored per child")}`);
    const { problems } = lintChange({ root, change: "a" });
    expect(problems).toContain("Touches does not list daily-limits");
    expect(problems).toContain('Touches names "web-ui", which is not a capability in openspec/specs or this change');
  });

  it("caps scenarios at 20 in light mode and 30 in full mode", () => {
    put("openspec/changes/a/proposal.md", proposal("daily-limits"));
    put("openspec/changes/a/specs/daily-limits/spec.md", `## MODIFIED Requirements\n\n${requirement("Limits are stored per child", 21)}`);
    expect(lintChange({ root, change: "a", light: true }).problems).toContain("21 scenarios; the light-mode limit is 20 (split the issue)");
    expect(lintChange({ root, change: "a", light: false }).problems).toEqual([]);
  });

  it("warns when another open change modifies the same requirement", () => {
    put("openspec/changes/a/proposal.md", proposal("daily-limits"));
    put("openspec/changes/a/specs/daily-limits/spec.md", `## MODIFIED Requirements\n\n${requirement("Limits are stored per child")}`);
    put("openspec/changes/b/specs/daily-limits/spec.md", `## MODIFIED Requirements\n\n${requirement("Limits are stored per child")}`);
    put("openspec/changes/archive/old/specs/daily-limits/spec.md", `## MODIFIED Requirements\n\n${requirement("Limits are stored per child")}`);
    const r = lintChange({ root, change: "a" });
    expect(r.problems).toEqual([]);
    expect(r.warnings).toEqual(['daily-limits: "Limits are stored per child" is also changed by open change b; state the order in Depends on']);
  });
});
