import { categoryDomains, RulesResponse, SEED_CATEGORIES, type Category } from "@fg/shared";
import { describe, expect, it, vi } from "vitest";
import { handleRules, type RulesStore } from "./rules-endpoint";
import { hashDeviceToken } from "./token";

const MAX_RULE_DOMAINS = 5000;

type Rule = { kind: "domain" | "category"; value: string };
type Override = { familyId: string | null; domain: string; category: Category };

type Limit = { category: Category; minutesPerDay: number };
type Step = "findChild" | "listRules" | "listCategoryOverrides" | "listLimits";

const CHILD = { deviceId: "dev-1", childId: "child-1", familyId: "fam-1", rulesVersion: 3, timezone: "Asia/Ho_Chi_Minh" };

function fakeStore(
  opts: { rules?: Rule[]; overrides?: Override[]; limits?: Limit[]; known?: boolean; throwIn?: Step; hours?: { start: string; end: string } | null; other?: unknown; otherThrows?: boolean } = {},
) {
  const order: string[] = [];
  const boom = (name: Step) => {
    order.push(name);
    if (opts.throwIn === name) throw new Error("db down");
  };
  const findChild = vi.fn(async (hash: string) => {
    boom("findChild");
    return (opts.known ?? true) && hash === hashDeviceToken("tok-1") ? { ...CHILD, allowedHours: opts.hours ?? null } : null;
  });
  const listRules = vi.fn(async (_childId: string) => {
    boom("listRules");
    return opts.rules ?? [{ kind: "domain" as const, value: "youtube.com" }, { kind: "category" as const, value: "games" }];
  });
  const listCategoryOverrides = vi.fn(async (_familyId: string) => {
    boom("listCategoryOverrides");
    return opts.overrides ?? [];
  });
  const listLimits = vi.fn(async (_childId: string) => {
    boom("listLimits");
    return opts.limits ?? [];
  });
  const otherUsage = vi.fn(async (_deviceId: string) => {
    if (opts.otherThrows) throw new Error("db down");
    return (opts.other ?? null) as Awaited<ReturnType<RulesStore["otherUsage"]>>;
  });
  const store: RulesStore = { findChild, listRules, listCategoryOverrides, listLimits, otherUsage };
  return { store, findChild, listRules, listCategoryOverrides, listLimits, otherUsage, order };
}

type Fake = ReturnType<typeof fakeStore>;

const call = (f: Fake, authorization: string | null = "Bearer tok-1") => handleRules({ authorization, store: f.store });

const domainsOf = (body: unknown) => (body as { domains: string[] }).domains;

describe("rules API for devices", () => {
  it("Valid token returns version and domains", async () => {
    const f = fakeStore();
    const res = await call(f);
    expect(f.findChild).toHaveBeenCalledWith(hashDeviceToken("tok-1"));
    expect(f.findChild.mock.calls.flat()).not.toContain("tok-1");
    expect(res.status).toBe(200);
    const body = RulesResponse.parse(res.body);
    expect(body.rulesVersion).toBe(3);
    expect(body.domains).toContain("youtube.com");
    expect(body.domains).toContain("roblox.com");
    expect(body.truncated).toBe(false);
    const cacheControl = Object.entries(res.headers).find(([k]) => k.toLowerCase() === "cache-control");
    expect(cacheControl?.[1]).toBe("no-store");
  });

  it("Family override applies, global row is used", async () => {
    const overrides: Override[] = [
      { familyId: "fam-1", domain: "roblox.com", category: "education" },
      { familyId: null, domain: "kidgame.com", category: "games" },
      { familyId: null, domain: "roblox.com", category: "games" },
    ];
    for (const rows of [overrides, [...overrides].reverse()]) {
      const f = fakeStore({ rules: [{ kind: "category", value: "games" }], overrides: rows });
      const res = await call(f);
      expect(res.status).toBe(200);
      expect(domainsOf(res.body)).toContain("kidgame.com");
      expect(domainsOf(res.body)).not.toContain("roblox.com");
    }
  });

  it("Bad token", async () => {
    for (const authorization of [null, "Basic abc", "Bearer tok-unknown"]) {
      const f = fakeStore();
      const res = await call(f, authorization);
      expect(res.status, String(authorization)).toBe(401);
      expect(res.body).toEqual({ error: "unauthorized" });
      expect(f.listRules).not.toHaveBeenCalled();
      expect(f.listCategoryOverrides).not.toHaveBeenCalled();
    }
  });

  it("Version read before rules", async () => {
    const f = fakeStore();
    await call(f);
    expect(f.order[0]).toBe("findChild");
    expect(f.order).toContain("listRules");
    expect(f.order).toContain("listCategoryOverrides");
    expect(f.order).toContain("listLimits");
  });

  it("Only the token's child", async () => {
    const f = fakeStore();
    await call(f);
    expect(f.listRules).toHaveBeenCalledWith("child-1");
    expect(f.listCategoryOverrides).toHaveBeenCalledWith("fam-1");
    expect(f.listLimits).toHaveBeenCalledWith("child-1");
  });

  it("Hours returned and null when unset", async () => {
    const hours = { start: "07:00", end: "21:00" };
    const set = await call(fakeStore({ hours }));
    expect((set.body as unknown as { allowedHours: unknown }).allowedHours).toEqual(hours);
    expect(RulesResponse.safeParse(set.body).success).toBe(true);
    const unset = await call(fakeStore());
    expect((unset.body as unknown as { allowedHours: unknown }).allowedHours).toBeNull();
    expect(RulesResponse.safeParse(unset.body).success).toBe(true);
  });

  it("Limits and timezone are returned", async () => {
    const limits: Limit[] = [
      { category: "games", minutesPerDay: 60 },
      { category: "entertainment", minutesPerDay: 90 },
    ];
    const res = await call(fakeStore({ limits }));
    const body = res.body as unknown as { limits: Limit[]; timezone: string };
    expect(body.limits).toEqual(limits);
    expect(body.timezone).toBe("Asia/Ho_Chi_Minh");
  });

  it("Merged rows, family wins, capped", async () => {
    const overrides: Override[] = [
      { familyId: null, domain: "youtube.com", category: "entertainment" },
      { familyId: null, domain: "kidgame.com", category: "games" },
      { familyId: "fam-1", domain: "youtube.com", category: "education" },
      { familyId: "fam-1", domain: "roblox.com", category: "games" },
    ];
    const res = await call(fakeStore({ overrides }));
    const body = res.body as unknown as { categoryOverrides: Record<string, string> };
    expect(body.categoryOverrides).toEqual({
      "youtube.com": "education",
      "roblox.com": "games",
      "kidgame.com": "games",
    });

    // 2 family rows + 4999 global rows = 5001 merged rows, capped at 5000
    const family: Override[] = [
      { familyId: "fam-1", domain: "fam-a.example.com", category: "games" },
      { familyId: "fam-1", domain: "fam-b.example.com", category: "games" },
    ];
    const global: Override[] = Array.from({ length: 4999 }, (_, i) => ({
      familyId: null,
      domain: `g${i}.example.com`,
      category: "games" as const,
    }));
    const capped = await call(fakeStore({ overrides: [...global, ...family] }));
    const map = (capped.body as unknown as { categoryOverrides: Record<string, string> }).categoryOverrides;
    expect(Object.keys(map)).toHaveLength(5000);
    expect(map).toHaveProperty(["fam-a.example.com"]);
    expect(map).toHaveProperty(["fam-b.example.com"]);
  });

  it("No limits", async () => {
    const res = await call(fakeStore());
    expect(res.status).toBe(200);
    expect((res.body as unknown as { limits: Limit[] }).limits).toEqual([]);
  });
});

describe("rules API fails closed and is capped", () => {
  it("Store failure fails closed", async () => {
    for (const throwIn of ["findChild", "listRules", "listCategoryOverrides", "listLimits"] as const) {
      const f = fakeStore({ throwIn });
      const res = await call(f);
      expect(res.status, throwIn).toBe(500);
      expect(res.body).toEqual({ error: "server_error" });
      expect(res.body).not.toHaveProperty("limits");
      expect(res.body).not.toHaveProperty("domains");
      expect(res.body).not.toHaveProperty("rulesVersion");
    }
  });

  it("Domain list is capped", async () => {
    const seedGames = Object.values(SEED_CATEGORIES).filter((c) => c === "games").length;
    const explicit = Array.from({ length: 10 }, (_, i) => `zz${i}.example.com`);
    const build = (total: number) => {
      const extra = total - explicit.length - seedGames;
      const overrides: Override[] = Array.from({ length: extra }, (_, i) => ({
        familyId: "fam-1",
        domain: `g${i}.gamesite.com`,
        category: "games" as const,
      }));
      const rules: Rule[] = [{ kind: "category", value: "games" }, ...explicit.map((value) => ({ kind: "domain" as const, value }))];
      return fakeStore({ rules, overrides });
    };

    const over = await call(build(MAX_RULE_DOMAINS + 1));
    expect(over.status).toBe(200);
    const domains = domainsOf(over.body);
    expect(domains).toHaveLength(MAX_RULE_DOMAINS);
    expect(domains.slice(0, 10)).toEqual(explicit);
    expect((over.body as { truncated: boolean }).truncated).toBe(true);

    const exact = await call(build(MAX_RULE_DOMAINS));
    expect(domainsOf(exact.body)).toHaveLength(MAX_RULE_DOMAINS);
    expect((exact.body as { truncated: boolean }).truncated).toBe(false);
  });

  it("Category domains are cut alphabetically", async () => {
    const explicit = Array.from({ length: 10 }, (_, i) => `zz${i}.example.com`);
    const hosts = Array.from({ length: 5100 }, (_, i) => `g${String(i).padStart(4, "0")}.bulkgames.com`);
    const overrides: Override[] = [...hosts]
      .reverse()
      .map((domain) => ({ familyId: "fam-1", domain, category: "games" as const }));
    const rules: Rule[] = [{ kind: "category", value: "games" }, ...explicit.map((value) => ({ kind: "domain" as const, value }))];
    const res = await call(fakeStore({ rules, overrides }));
    const body = res.body as unknown as { domains: string[]; categoryOverrides: Record<string, Category> };
    // 5000 total - 10 explicit = 4990 category domains, taken from the alphabetical list
    const expected = categoryDomains({
      categories: ["games"],
      overrides: body.categoryOverrides,
      exclude: explicit,
      limit: MAX_RULE_DOMAINS - explicit.length,
    }).domains;
    expect(expected).toHaveLength(4990);
    expect(body.domains).toEqual([...explicit, ...expected]);
    expect(body.domains.slice(10)).toEqual([...body.domains.slice(10)].sort());
  });
});

describe("rules other usage", () => {
  it("Rules include other usage", async () => {
    const other = { day: "2026-11-17", seconds: { games: 600 } };
    const res = await call(fakeStore({ other }));
    expect(res.status).toBe(200);
    expect(() => RulesResponse.parse(res.body)).not.toThrow();
    expect((res.body as { otherUsage?: unknown }).otherUsage).toEqual(other);
  });

  it("Other usage fails", async () => {
    const res = await call(fakeStore({ otherThrows: true }));
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("otherUsage");
  });

  it("Invalid value does not cause a 500", async () => {
    const res = await call(fakeStore({ other: { day: "x", seconds: { games: -1 } } }));
    expect(res.status).toBe(200);
    expect(domainsOf(res.body)).toContain("youtube.com");
    expect(res.body).not.toHaveProperty("otherUsage");
  });
});
