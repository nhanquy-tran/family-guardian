import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("platform notes", () => {
  it("Notes section exists", () => {
    const notes = readFileSync(join(__dirname, "..", "..", "..", "docs", "platform-notes.md"), "utf8");
    const start = notes.indexOf("\n## Firefox");
    expect(start).toBeGreaterThanOrEqual(0);
    const rest = notes.slice(start + 1);
    const end = rest.indexOf("\n## ", 3);
    const section = (end === -1 ? rest : rest.slice(0, end)).toLowerCase();
    for (const word of ["manifest", "smoke", "pairing", "idle", "offline", "block page", "blocked.html", "limit", "allowed hours", "badge"]) {
      expect(section, word).toContain(word);
    }
  });
});
