import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Denied tool calls cost about 12% of agent spend (factory cost review, Nov 2026); most were read-only commands.
const READ_ONLY = ["Bash(cat:*)", "Bash(head:*)", "Bash(tail:*)", "Bash(wc:*)", "Bash(grep:*)", "Bash(ls:*)"];
const lines = readdirSync(".github/workflows")
  .filter((f) => f.endsWith(".yml"))
  .flatMap((f) =>
    readFileSync(`.github/workflows/${f}`, "utf8")
      .split("\n")
      .filter((l) => l.includes("Bash(cd:*)") && l.includes("Read,"))
      .map((l) => [f, l]),
  );

describe("agent allowlists", () => {
  it("exist", () => {
    expect(lines.length).toBeGreaterThanOrEqual(10);
  });

  it.each(lines)("%s allows the read-only shell commands", (_file, line) => {
    for (const tool of READ_ONLY) expect(line).toContain(tool);
  });
});
