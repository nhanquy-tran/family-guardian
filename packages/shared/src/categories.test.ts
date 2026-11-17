import { describe, expect, it } from "vitest";
import { CATEGORIES, SEED_CATEGORIES, categorize } from "./categories";
import * as entry from "./index";

describe("Fixed category list", () => {
  it("Exported list matches the agreed categories", () => {
    expect([...CATEGORIES]).toEqual([
      "education",
      "entertainment",
      "social",
      "games",
      "news",
      "shopping",
      "communication",
      "productivity",
      "other",
    ]);
  });
});

describe("Seed domain map", () => {
  const entries = Object.entries(SEED_CATEGORIES);

  it("Seed size is about 150", () => {
    expect(entries.length).toBeGreaterThanOrEqual(140);
    expect(entries.length).toBeLessThanOrEqual(170);
  });

  it("Seed keys and values are well formed", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, value] of entries) {
      expect(key).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
      expect(key.startsWith("www.")).toBe(false);
      expect(CATEGORIES).toContain(value);
    }
  });

  it("Seed contains the issue's example domains", () => {
    expect(SEED_CATEGORIES["youtube.com"]).toBe("entertainment");
    expect(SEED_CATEGORIES["tiktok.com"]).toBe("social");
    expect(SEED_CATEGORIES["facebook.com"]).toBe("social");
    expect(SEED_CATEGORIES["roblox.com"]).toBe("games");
    expect(SEED_CATEGORIES["khanacademy.org"]).toBe("education");
    expect(SEED_CATEGORIES["vnexpress.net"]).toBe("news");
    expect(SEED_CATEGORIES["zalo.me"]).toBe("communication");
    expect(SEED_CATEGORIES["docs.google.com"]).toBe("productivity");
    expect(SEED_CATEGORIES["classroom.google.com"]).toBe("education");
  });

  it("Seed covers Vietnamese sites", () => {
    const count = Object.keys(SEED_CATEGORIES).filter(
      (k) => k.endsWith(".vn") || k === "vnexpress.net" || k === "zalo.me",
    ).length;
    expect(count).toBeGreaterThanOrEqual(15);
  });
});

describe("Categorize returns seed category or other", () => {
  it("Known domain", () => {
    expect(categorize("khanacademy.org")).toBe("education");
  });

  it("Unknown domain", () => {
    expect(categorize("unknown-example-site.com")).toBe("other");
  });

  it("Empty or IP input", () => {
    expect(categorize("")).toBe("other");
    expect(categorize("192.168.1.10")).toBe("other");
    expect(categorize("localhost")).toBe("other");
  });
});

describe("Input normalization", () => {
  it("Mixed case and trailing dot", () => {
    expect(categorize("YouTube.COM.")).toBe("entertainment");
    expect(categorize(" youtube.com ")).toBe("entertainment");
  });
});

describe("Subdomain resolution", () => {
  it("www prefix falls back to the registrable domain", () => {
    expect(categorize("www.youtube.com")).toBe("entertainment");
    expect(categorize("m.youtube.com")).toBe("entertainment");
  });

  it("Explicitly listed subdomain keeps its own category", () => {
    expect(SEED_CATEGORIES["docs.google.com"]).toBe("productivity");
    expect(SEED_CATEGORIES["classroom.google.com"]).toBe("education");
    expect(categorize("docs.google.com")).toBe("productivity");
    expect(categorize("classroom.google.com")).toBe("education");
  });

  it("Deeper subdomain of a listed subdomain", () => {
    expect(categorize("a.b.docs.google.com")).toBe("productivity");
  });

  it("Multi-part public suffix", () => {
    expect(SEED_CATEGORIES["dantri.com.vn"]).toBe("news");
    expect(categorize("www.dantri.com.vn")).toBe("news");
    expect(categorize("unknown.com.vn")).toBe("other");
  });
});

describe("Overrides take precedence", () => {
  it("Override replaces seed category", () => {
    expect(categorize("youtube.com", { "youtube.com": "education" })).toBe("education");
  });

  it("Override applies to subdomains", () => {
    expect(categorize("www.youtube.com", { "youtube.com": "education" })).toBe("education");
  });

  it("Override for unknown domain", () => {
    expect(categorize("myschool.edu.vn", { "myschool.edu.vn": "education" })).toBe("education");
  });

  it("Override on parent beats more specific seed entry", () => {
    expect(categorize("docs.google.com", { "google.com": "other" })).toBe("other");
  });

  it("Most specific override wins", () => {
    expect(
      categorize("docs.google.com", { "google.com": "other", "docs.google.com": "education" }),
    ).toBe("education");
  });

  it("Empty or missing overrides use the seed", () => {
    expect(categorize("facebook.com", {})).toBe("social");
    expect(categorize("facebook.com")).toBe("social");
  });
});

describe("Public API from the shared package", () => {
  it("Import from the package entry", () => {
    expect(entry.categorize).toBeDefined();
    expect(entry.CATEGORIES).toBeDefined();
    expect(entry.categorize("roblox.com")).toBe("games");
  });
});
