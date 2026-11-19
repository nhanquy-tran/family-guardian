import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const script = resolve(".github/scripts/factory-eval.mjs");
let root;
const put = (path, text) => {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
};
const coverage = (...tests) => execFileSync(process.execPath, [script, "coverage", "c", ...tests], { cwd: root, encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: "" } });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "factory-eval-"));
  put(
    "openspec/changes/c/specs/cap/spec.md",
    "## MODIFIED Requirements\n\n### Requirement: R\nThe system SHALL do it.\n\n#### Scenario: New behaviour\nFile: `src/new.test.ts`\n- **WHEN** x\n- **THEN** y\n\n#### Scenario: Old behaviour kept\nFile: `src/old.test.ts`\n- **WHEN** x\n- **THEN** y\n",
  );
  put("src/new.test.ts", 'it("New behaviour", () => {});\n');
  put("src/old.test.ts", 'it("Old behaviour kept", () => {});\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("factory-eval coverage", () => {
  it("counts an unchanged scenario whose test exists in the file the spec names", () => {
    expect(coverage("src/new.test.ts")).toContain("2/2 scenarios have a test with their title");
  });

  it("still reports a scenario with no test anywhere", () => {
    put("src/old.test.ts", 'it("something else", () => {});\n');
    const out = coverage("src/new.test.ts");
    expect(out).toContain("1/2 scenarios");
    expect(out).toContain("- missing: Old behaviour kept");
  });
});
