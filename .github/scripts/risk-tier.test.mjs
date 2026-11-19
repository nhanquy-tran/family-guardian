import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { riskOf } from "./risk-tier.mjs";

let root;
const put = (path, text) => {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
};
const delta = (name) => `## MODIFIED Requirements\n\n### Requirement: ${name}\nThe system SHALL do it.\n\n#### Scenario: it works\n- **WHEN** it happens\n- **THEN** it works\n`;
const change = ({ touches, caps = [], tasks = "- [ ] 1.1 Add a test in apps/web/src/x.test.ts\n", design = "## Decisions\n- Keep it simple.\n" }) => {
  put("openspec/changes/c/proposal.md", `Depends on: none\nTouches: ${touches}\n\n## Why\nBecause.\n`);
  put("openspec/changes/c/tasks.md", tasks);
  put("openspec/changes/c/design.md", design);
  for (const cap of caps) put(`openspec/changes/c/specs/${cap}/spec.md`, delta("Something"));
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "risk-tier-"));
  for (const cap of ["limit-badge", "daily-limits", "usage-dashboard", "web-ui", "parent-auth"]) {
    put(`openspec/specs/${cap}/spec.md`, `# ${cap}\n\n## Purpose\nX.\n\n## Requirements\n\n### Requirement: Something\nThe system SHALL.\n`);
  }
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("riskOf", () => {
  it("rates a small change to one existing capability as normal", () => {
    change({ touches: "limit-badge", caps: ["limit-badge"] });
    expect(riskOf({ root, change: "c" })).toEqual({ risky: false, reasons: [] });
  });

  it("rates a new capability as risky", () => {
    change({ touches: "weekly-digest", caps: ["weekly-digest"] });
    expect(riskOf({ root, change: "c" }).reasons).toContain("new capability weekly-digest");
  });

  it("rates three or more capabilities as risky", () => {
    change({ touches: "limit-badge, daily-limits, usage-dashboard", caps: ["limit-badge"] });
    const r = riskOf({ root, change: "c" });
    expect(r.risky).toBe(true);
    expect(r.reasons).toContain("touches 3 capabilities");
  });

  it("does not count hot files as capabilities", () => {
    change({ touches: "limit-badge, web-ui, packages/shared/src/index.ts", caps: ["limit-badge"] });
    expect(riskOf({ root, change: "c" }).risky).toBe(false);
  });

  it("rates a database migration as risky, from Touches or from the tasks", () => {
    change({ touches: "limit-badge, supabase/migrations", caps: ["limit-badge"] });
    expect(riskOf({ root, change: "c" }).reasons).toContain("database migration");
    change({ touches: "limit-badge", caps: ["limit-badge"], tasks: "- [ ] 1.1 Add a migration with a new column\n" });
    expect(riskOf({ root, change: "c" }).reasons).toContain("database migration");
  });

  it("rates a sensitive capability as risky", () => {
    change({ touches: "parent-auth", caps: ["parent-auth"] });
    expect(riskOf({ root, change: "c" }).reasons).toContain("sensitive capability parent-auth");
  });

  it("rates a new dependency as risky", () => {
    change({ touches: "limit-badge", caps: ["limit-badge"], design: "## Decisions\n- Add a new dependency on date-fns.\n" });
    expect(riskOf({ root, change: "c" }).reasons).toContain("new dependency");
  });

  it("ignores a design that says no new library is needed", () => {
    change({ touches: "limit-badge", caps: ["limit-badge"], design: "## Decisions\n- No new library, no CSS-in-JS. No ADR: no new library or service.\n" });
    expect(riskOf({ root, change: "c" }).risky).toBe(false);
  });

  it("rates owner labels and a new ADR as risky", () => {
    change({ touches: "limit-badge", caps: ["limit-badge"] });
    const r = riskOf({ root, change: "c", labels: ["full-mode", "privacy", "enhancement"], addsAdr: true });
    expect(r.reasons).toEqual(["label full-mode", "label privacy", "adds an ADR"]);
  });
});
