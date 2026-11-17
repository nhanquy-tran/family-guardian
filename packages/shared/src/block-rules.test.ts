import { describe, expect, it } from "vitest";
import { expandBlockRules } from "./block-rules";
import { categorize } from "./categories";

describe("expandBlockRules", () => {
  it("Domain rules only", () => {
    expect(
      expandBlockRules([
        { kind: "domain", value: "zeta.com" },
        { kind: "domain", value: "alpha.com" },
      ]),
    ).toEqual(["alpha.com", "zeta.com"]);
  });

  it("Category expands from the seed", () => {
    const result = expandBlockRules([{ kind: "category", value: "games" }]);
    expect(result).toContain("roblox.com");
    for (const domain of result) expect(categorize(domain), domain).toBe("games");
    expect(result).not.toContain("youtube.com");
  });

  it("Overrides move domains in and out", () => {
    const result = expandBlockRules([{ kind: "category", value: "games" }], {
      "roblox.com": "education",
      "myschoolgame.vn": "games",
    });
    expect(result).toContain("myschoolgame.vn");
    expect(result).not.toContain("roblox.com");
  });

  it("No duplicates", () => {
    const result = expandBlockRules([
      { kind: "category", value: "entertainment" },
      { kind: "domain", value: "youtube.com" },
    ]);
    expect(result.filter((d) => d === "youtube.com")).toHaveLength(1);
    expect(result).toEqual([...result].sort());
    expect(new Set(result).size).toBe(result.length);
  });

  it("No rules", () => {
    expect(expandBlockRules([])).toEqual([]);
  });
});
