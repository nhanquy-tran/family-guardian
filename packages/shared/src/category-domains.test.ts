import { describe, expect, it } from "vitest";
import { categorize, SEED_CATEGORIES, type Category } from "./categories";
import { categoryDomains } from "./category-domains";
import { categoryDomains as fromIndex } from "./index";

const VALID = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const seedGames = Object.keys(SEED_CATEGORIES).filter((d) => SEED_CATEGORIES[d] === "games" && VALID.test(d));
const games = (hosts: string[]): Record<string, Category> => Object.fromEntries(hosts.map((h) => [h, "games" as const]));
const bulkHosts = (n: number) => Array.from({ length: n }, (_, i) => `g${i}.bulkgames.com`);

describe("categoryDomains", () => {
  it("Seed domains of a category", () => {
    const { domains, truncated } = categoryDomains({ categories: ["games"], limit: 5000 });
    expect(domains).toContain("roblox.com");
    expect(domains).not.toContain("youtube.com");
    for (const d of domains) expect(categorize(d)).toBe("games");
    expect(domains).toEqual([...domains].sort());
    expect(truncated).toBe(false);
  });

  it("Overrides win over the seed", () => {
    const { domains } = categoryDomains({
      categories: ["games"],
      overrides: { "roblox.com": "education", "myschoolgame.vn": "games" },
      limit: 5000,
    });
    expect(domains).toContain("myschoolgame.vn");
    expect(domains).not.toContain("roblox.com");
  });

  it("Extra hosts and exclusions", () => {
    const { domains } = categoryDomains({
      categories: ["games"],
      overrides: { "newgame.example.com": "games" },
      extraHosts: ["newgame.example.com", "docs.google.com"],
      exclude: ["roblox.com"],
      limit: 5000,
    });
    expect(domains).toContain("newgame.example.com");
    expect(domains).toContain("minecraft.net");
    expect(domains).not.toContain("docs.google.com");
    expect(domains).not.toContain("roblox.com");
  });

  it("Invalid hosts do not use up room", () => {
    const long = "a".repeat(250) + ".com"; // 250 + 4 = 254 characters
    expect(long).toHaveLength(254);
    const { domains, truncated } = categoryDomains({
      categories: ["games"],
      overrides: games(["bad_host", "UPPER.com", long]),
      limit: seedGames.length,
    });
    for (const bad of ["bad_host", "UPPER.com", long]) expect(domains).not.toContain(bad);
    expect([...domains].sort()).toEqual([...seedGames].sort());
    expect(truncated).toBe(false);
  });

  it("Cap and truncated flag", () => {
    const overrides = games(bulkHosts(5100));
    const full = categoryDomains({ categories: ["games"], overrides, limit: Number.MAX_SAFE_INTEGER });
    const capped = categoryDomains({ categories: ["games"], overrides, limit: 5000 });
    expect(capped.domains).toHaveLength(5000);
    expect(capped.domains).toEqual(full.domains.slice(0, 5000));
    expect(capped.truncated).toBe(true);
    const exact = categoryDomains({ categories: ["games"], overrides, limit: full.domains.length });
    expect(exact.domains).toEqual(full.domains);
    expect(exact.truncated).toBe(false);
  });

  it("Input order does not change the result", () => {
    const hosts = bulkHosts(5100);
    const extra = ["x1.example.com", "x2.example.com", "x3.example.com"];
    const a = categoryDomains({ categories: ["games"], overrides: games([...hosts, ...extra]), extraHosts: extra, limit: 5000 });
    const b = categoryDomains({
      categories: ["games"],
      overrides: games([...extra, ...hosts].reverse()),
      extraHosts: [...extra].reverse(),
      limit: 5000,
    });
    expect(a.domains).toHaveLength(5000);
    expect(a.domains).toEqual(b.domains);
  });

  it("No categories or zero limit", () => {
    expect(categoryDomains({ categories: [], limit: 5000 })).toEqual({ domains: [], truncated: false });
    expect(categoryDomains({ categories: ["games"], limit: 0 })).toEqual({ domains: [], truncated: true });
  });

  it("Import from the package entry", () => {
    expect(fromIndex).toBeDefined();
  });
});
