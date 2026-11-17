import { describe, expect, it, vi } from "vitest";
import { addCategoryRule, addDomainRule, listBlockRules, normalizeBlockDomain, removeBlockRule } from "./block-rules";

type Client = Parameters<typeof addDomainRule>[0];
type Result = { data?: unknown; error: unknown };
type Call = { table: string; ops: [string, unknown[]][] };
type Results = { insert?: Result; delete?: Result; select?: Result };

const CHILD = "child-1";
const DB_ERROR = { code: "XX000", message: "secret-db-failure-text" };

/** Records every from() call and chained operation; the result depends on the write operation used. */
function fakeClient(results: Results = {}) {
  const calls: Call[] = [];
  const from = vi.fn((table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const resolveResult = (): Result => {
      const has = (m: string) => call.ops.some(([op]) => op === m);
      if (has("insert")) return results.insert ?? { data: null, error: null };
      if (has("delete")) return results.delete ?? { data: [], error: null };
      return results.select ?? { data: [], error: null };
    };
    const chain: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(resolveResult()).then(resolve, reject),
      single: () => Promise.resolve(resolveResult()),
      maybeSingle: () => Promise.resolve(resolveResult()),
    };
    for (const method of ["select", "insert", "update", "delete", "upsert", "eq", "order", "limit"]) {
      chain[method] = (...args: unknown[]) => {
        call.ops.push([method, args]);
        return chain;
      };
    }
    return chain;
  });
  const inserts = () => calls.filter((c) => c.table === "block_rules" && c.ops.some(([m]) => m === "insert"));
  return { client: { from } as unknown as Client, from, calls, inserts };
}

describe("normalizeBlockDomain", () => {
  it("URLs and casing reduce to the host", () => {
    for (const input of [" https://www.YouTube.com/watch?v=x ", "youtube.com/shorts", "WWW.youtube.com.", "youtube.com:443"]) {
      expect(normalizeBlockDomain(input), input).toBe("youtube.com");
    }
  });

  it("Subdomains are kept", () => {
    expect(normalizeBlockDomain("docs.google.com")).toBe("docs.google.com");
  });

  it("Invalid input", () => {
    for (const input of ["", "localhost", "192.168.1.10", "not a domain", "ftp://"]) {
      expect(normalizeBlockDomain(input), input).toBeNull();
    }
  });
});

describe("block rule management", () => {
  it("Add a domain rule", async () => {
    const f = fakeClient();
    expect(await addDomainRule(f.client, CHILD, "https://www.tiktok.com/@x")).toEqual({ ok: true });
    const inserts = f.inserts();
    expect(inserts).toHaveLength(1);
    expect(inserts[0].ops).toContainEqual(["insert", [{ child_id: CHILD, kind: "domain", value: "tiktok.com" }]]);
  });

  it("Add a category rule", async () => {
    const f = fakeClient();
    expect(await addCategoryRule(f.client, CHILD, "games")).toEqual({ ok: true });
    const inserts = f.inserts();
    expect(inserts).toHaveLength(1);
    expect(inserts[0].ops).toContainEqual(["insert", [{ child_id: CHILD, kind: "category", value: "games" }]]);
  });

  it("Invalid input is not written", async () => {
    const f = fakeClient();
    expect(await addDomainRule(f.client, CHILD, "localhost")).toEqual({ ok: false, error: "invalid_domain" });
    expect(await addCategoryRule(f.client, CHILD, "music")).toEqual({ ok: false, error: "invalid_category" });
    expect(f.inserts()).toHaveLength(0);
  });

  it("Duplicate rule", async () => {
    const f = fakeClient({ insert: { error: { code: "23505", message: "duplicate key" } } });
    expect(await addDomainRule(f.client, CHILD, "youtube.com")).toEqual({ ok: false, error: "duplicate" });
  });

  it("Remove a rule", async () => {
    const found = fakeClient({ delete: { data: [{ id: "rule-1" }], error: null } });
    expect(await removeBlockRule(found.client, "rule-1")).toEqual({ ok: true });
    const del = found.calls.find((c) => c.table === "block_rules" && c.ops.some(([m]) => m === "delete"));
    expect(del).toBeDefined();
    expect(del!.ops).toContainEqual(["eq", ["id", "rule-1"]]);

    const missing = fakeClient({ delete: { data: [], error: null } });
    expect(await removeBlockRule(missing.client, "rule-1")).toEqual({ ok: false, error: "not_found" });
  });

  it("List rules sorted", async () => {
    const f = fakeClient({
      select: {
        data: [
          { id: "r1", kind: "domain", value: "youtube.com" },
          { id: "r2", kind: "category", value: "games" },
          { id: "r3", kind: "domain", value: "abc.com" },
        ],
        error: null,
      },
    });
    const result = await listBlockRules(f.client, CHILD);
    const call = f.calls.find((c) => c.table === "block_rules");
    expect(call!.ops).toContainEqual(["eq", ["child_id", CHILD]]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rules.map((r) => `${r.kind} ${r.value}`)).toEqual(["category games", "domain abc.com", "domain youtube.com"]);
    }
  });

  it("Store failure returns an error code", async () => {
    const f = fakeClient({
      insert: { error: DB_ERROR },
      delete: { data: null, error: DB_ERROR },
      select: { data: null, error: DB_ERROR },
    });
    const results = await Promise.all([
      addDomainRule(f.client, CHILD, "youtube.com"),
      removeBlockRule(f.client, "rule-1"),
      listBlockRules(f.client, CHILD),
    ]);
    expect(results[0]).toEqual({ ok: false, error: "failed" });
    expect(results[1]).toEqual({ ok: false, error: "failed" });
    expect(results[2].ok).toBe(false);
    expect(JSON.stringify(results)).not.toContain(DB_ERROR.message);
  });
});
