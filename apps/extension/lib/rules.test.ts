import { describe, expect, it, vi } from "vitest";
import { applyRules, buildRules, syncRules } from "./rules";
import { createDnr, createGet, createStore, type Reply } from "./test-fakes";

const rule = (id: number, domain: string) => ({
  id,
  priority: 1,
  action: { type: "redirect", redirect: { extensionPath: `/blocked.html?d=${domain}` } },
  condition: { requestDomains: [domain], resourceTypes: ["main_frame"] },
});

describe("buildRules", () => {
  it("Rule shape", () => {
    expect(buildRules(["tiktok.com"])).toEqual([rule(1, "tiktok.com")]);
  });

  it("Invalid, duplicate and excess domains", () => {
    const built = buildRules(["a.com", "a.com", "bad domain", "https://x.com/p", "", "b.com"]);
    expect(built).toEqual([rule(1, "a.com"), rule(2, "b.com")]);
    // 5001 distinct valid domains d0.com..d5000.com, capped at MAX_RULE_DOMAINS = 5000
    const many = Array.from({ length: 5001 }, (_, i) => `d${i}.com`);
    const capped = buildRules(many);
    expect(capped).toHaveLength(5000);
    expect(capped[0]).toEqual(rule(1, "d0.com"));
    expect(capped[4999]).toEqual(rule(5000, "d4999.com"));
  });
});

describe("applyRules", () => {
  it("Replace existing rules", async () => {
    const { dnr, updates } = createDnr([1, 2, 3]);
    await applyRules(dnr, ["a.com"]);
    expect(updates).toEqual([{ removeRuleIds: [1, 2, 3], addRules: [rule(1, "a.com")] }]);
  });

  it("Empty rule list clears blocking", async () => {
    const { dnr, updates } = createDnr([1]);
    await applyRules(dnr, []);
    expect(updates).toEqual([{ removeRuleIds: [1], addRules: [] }]);
  });
});

const good: Reply = { status: 200, body: { rulesVersion: 3, domains: ["a.com"], truncated: false } };
const stored = { rulesVersion: 2, rulesDomains: ["old.com"] };

function sync(
  initial: Record<string, unknown>,
  get: ReturnType<typeof createGet>["get"],
  dnr: ReturnType<typeof createDnr>["dnr"],
) {
  const fake = createStore(initial);
  const result = syncRules({ baseUrl: "https://fg.example", token: "tok-1", store: fake.store, get, dnr });
  return { result, data: fake.data };
}

describe("syncRules", () => {
  it("Server or network failure", async () => {
    const replies: Reply[] = [
      { status: 500, body: { error: "server_error" } },
      "network",
      { status: 401, body: { error: "unauthorized" } },
      { status: 200, body: { domains: "x" } },
    ];
    for (const reply of replies) {
      const { get } = always2(reply);
      const { dnr, updates } = createDnr([1]);
      const { result, data } = sync(stored, get, dnr);
      expect(await result).toEqual({ kind: "failed" });
      expect(updates).toHaveLength(0);
      expect(data.get("rulesVersion")).toBe(2);
      expect(data.get("rulesDomains")).toEqual(["old.com"]);
    }
  });

  it("DNR update fails", async () => {
    const { get } = always2(good);
    const { dnr } = createDnr([1], { failUpdate: true });
    const { result, data } = sync(stored, get, dnr);
    expect(await result).toEqual({ kind: "failed" });
    expect(data.get("rulesVersion")).toBe(2);
    expect(data.get("rulesDomains")).toEqual(["old.com"]);
  });

  it("success applies rules and stores the version from the rules response", async () => {
    const { get, calls } = always2(good);
    const { dnr, updates } = createDnr([1]);
    const { result, data } = sync(stored, get, dnr);
    expect(await result).toEqual({ kind: "ok", rulesVersion: 3 });
    expect(calls).toHaveLength(1);
    expect(updates).toEqual([{ removeRuleIds: [1], addRules: [rule(1, "a.com")] }]);
    expect(data.get("rulesVersion")).toBe(3);
    expect(data.get("rulesDomains")).toEqual(["a.com"]);
  });
});

describe("syncRules and limits", () => {
  const body = (extra: Record<string, unknown>): Reply => ({
    status: 200,
    body: { rulesVersion: 3, domains: [], truncated: false, ...extra },
  });
  const limitState = {
    rulesVersion: 2,
    rulesDomains: [],
    rulesLimits: [{ category: "games", minutesPerDay: 1 }],
    rulesTimezone: "UTC",
    rulesOverrides: {},
    limitUsage: { day: "2026-11-17", seconds: { games: 120 }, domains: {} },
    limitBlocked: { "roblox.com": "games" },
  };
  const paths = (rules: { action: { redirect: { extensionPath: string } } }[]) =>
    rules.map((r) => r.action.redirect.extensionPath);

  async function withToday<T>(run: () => Promise<T>): Promise<T> {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-11-17T10:05:30Z"));
    try {
      return await run();
    } finally {
      vi.useRealTimers();
    }
  }

  it("Sync stores inputs and unblocks", async () => {
    await withToday(async () => {
      const raised = { limits: [{ category: "games", minutesPerDay: 5 }] };
      const first = createDnr([1, 2]);
      const a = sync(limitState, always2(body(raised)).get, first.dnr);
      expect(await a.result).toEqual({ kind: "ok", rulesVersion: 3 });
      // 120 seconds is below 5 * 60 = 300, so no games rule is applied
      expect(paths(first.updates[0]?.addRules ?? [])).toEqual([]);
      expect(a.data.get("rulesLimits")).toEqual(raised.limits);
      expect(a.data.get("limitBlocked")).toEqual({});

      const second = createDnr([1, 2]);
      const b = sync(limitState, always2(body({ limits: [] })).get, second.dnr);
      await b.result;
      expect(b.data.get("rulesLimits")).toEqual([]);
      expect(b.data.get("limitBlocked")).toEqual({});
      expect(paths(second.updates[0]?.addRules ?? [])).toEqual([]);
    });
  });

  it("Failed sync keeps limits", async () => {
    const keep = {
      rulesVersion: 2,
      rulesDomains: ["old.com"],
      rulesLimits: [{ category: "games", minutesPerDay: 5 }],
      rulesTimezone: "Asia/Ho_Chi_Minh",
      rulesOverrides: { "youtube.com": "education" },
    };
    const replies: Reply[] = [{ status: 500 }, "network", body({ categoryOverrides: "x" })];
    for (const reply of replies) {
      const { dnr, updates } = createDnr([1]);
      const { result, data } = sync(keep, always2(reply).get, dnr);
      expect(await result).toEqual({ kind: "failed" });
      expect(updates).toHaveLength(0);
      expect(data.get("rulesLimits")).toEqual(keep.rulesLimits);
      expect(data.get("rulesTimezone")).toBe(keep.rulesTimezone);
      expect(data.get("rulesOverrides")).toEqual(keep.rulesOverrides);
    }
  });

  it("Manual-rule sync keeps limit blocks", async () => {
    await withToday(async () => {
      const over = {
        ...limitState,
        limitUsage: { day: "2026-11-17", seconds: { games: 300 }, domains: {} },
      };
      const answer = body({ domains: ["tiktok.com"], limits: [{ category: "games", minutesPerDay: 5 }], timezone: "UTC" });
      const { dnr, updates } = createDnr([1, 2]);
      const { result, data } = sync(over, always2(answer).get, dnr);
      await result;
      const added = updates[0]?.addRules ?? [];
      const all = paths(added);
      expect(all).toContain("/blocked.html?d=tiktok.com");
      expect(all).toContain("/blocked.html?d=roblox.com&c=games");
      expect(added.find((r) => r.condition.requestDomains?.[0] === "tiktok.com")?.id).toBe(1);
      expect(data.get("limitBlocked")).toMatchObject({ "roblox.com": "games" });
    });
  });
});

function always2(reply: Reply) {
  return createGet(() => reply);
}

describe("syncRules and allowed hours", () => {
  const answer = (allowedHours: unknown): Reply => ({
    status: 200,
    body: { rulesVersion: 3, domains: ["a.com"], truncated: false, timezone: "UTC", allowedHours },
  });
  const now = Date.parse("2026-11-17T22:00:00Z");
  const hours = { start: "07:00", end: "21:00" };
  const run = (initial: Record<string, unknown>, reply: Reply, dnr: ReturnType<typeof createDnr>["dnr"]) => {
    const fake = createStore(initial);
    const result = syncRules({
      baseUrl: "https://fg.example",
      token: "tok-1",
      store: fake.store,
      get: createGet(() => reply).get,
      dnr,
      now,
    });
    return { result, data: fake.data };
  };

  it("Sync keeps and updates the hours", async () => {
    const first = createDnr([1, 2000000]);
    const a = run({ rulesVersion: 2 }, answer(hours), first.dnr);
    expect((await a.result).kind).toBe("ok");
    expect(first.updates[0]?.removeRuleIds).toEqual([1]);
    expect(first.updates[0]?.addRules).toEqual([rule(1, "a.com")]);
    expect(first.rules().map((r) => r.id)).toContain(2000000);
    expect(a.data.get("rulesAllowedHours")).toEqual(hours);

    const second = createDnr([1, 2000000]);
    const b = run({ rulesVersion: 2, rulesAllowedHours: hours }, answer(null), second.dnr);
    expect((await b.result).kind).toBe("ok");
    expect(b.data.has("rulesAllowedHours")).toBe(false);
    expect(second.rules().map((r) => r.id)).not.toContain(2000000);

    const third = createDnr([1, 2000000], { failUpdate: true });
    const c = run({ rulesVersion: 2, rulesAllowedHours: hours }, answer(null), third.dnr);
    expect(await c.result).toEqual({ kind: "failed" });
    expect(c.data.get("rulesAllowedHours")).toEqual(hours);
    expect(c.data.get("rulesVersion")).toBe(2);
    expect(third.rules().map((r) => r.id)).toEqual([1, 2000000]);
  });
});
