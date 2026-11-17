import { describe, expect, it } from "vitest";
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

function always2(reply: Reply) {
  return createGet(() => reply);
}
