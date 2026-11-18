import { describe, expect, it, vi } from "vitest";
import { listCategoryOverrides, removeCategoryOverride, saveCategoryOverride } from "./category-overrides";

type Client = Parameters<typeof saveCategoryOverride>[0];
type Result = { data?: unknown; error: unknown };
type Call = { table: string; ops: [string, unknown[]][] };
type Results = { parents?: Result; upsert?: Result; select?: Result; delete?: Result };

const DB_ERROR = { code: "XX000", message: "secret-db-failure-text" };

/** Records every from() call and chained operation; the result depends on the table and write operation used. */
function fakeClient(results: Results = {}) {
  const calls: Call[] = [];
  const from = vi.fn((table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const has = (m: string) => call.ops.some(([op]) => op === m);
    const resolveResult = (): Result => {
      if (table === "parents") return results.parents ?? { data: { family_id: "fam-1" }, error: null };
      if (has("upsert") || has("insert")) return results.upsert ?? { data: null, error: null };
      if (has("delete")) return results.delete ?? { data: [], error: null };
      return results.select ?? { data: [], error: null };
    };
    const chain: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(resolveResult()).then(resolve, reject),
      single: () => Promise.resolve(resolveResult()),
      maybeSingle: () => Promise.resolve(resolveResult()),
    };
    for (const method of ["select", "insert", "update", "delete", "upsert", "eq", "not", "is", "order", "limit"]) {
      chain[method] = (...args: unknown[]) => {
        call.ops.push([method, args]);
        return chain;
      };
    }
    return chain;
  });
  const writes = () =>
    calls.filter((c) => c.table === "domain_categories" && c.ops.some(([m]) => ["upsert", "insert", "update", "delete"].includes(m)));
  const op = (call: Call | undefined, name: string) => call?.ops.find(([m]) => m === name);
  return { client: { from } as unknown as Client, from, calls, writes, op };
}

describe("category override data access", () => {
  it("Save normalises the domain and upserts", async () => {
    const f = fakeClient();
    const result = await saveCategoryOverride(f.client, " https://www.YouTube.com/watch?v=x ", "education");
    expect(result).toEqual({ ok: true });
    const writes = f.writes();
    expect(writes).toHaveLength(1);
    const upsert = f.op(writes[0], "upsert");
    expect(upsert?.[1][0]).toEqual({ family_id: "fam-1", domain: "youtube.com", category: "education" });
    expect(upsert?.[1][1]).toMatchObject({ onConflict: "family_id,domain" });
  });

  it("Invalid input is not written", async () => {
    const f = fakeClient();
    expect(await saveCategoryOverride(f.client, "localhost", "games")).toEqual({ ok: false, error: "invalid_domain" });
    expect(await saveCategoryOverride(f.client, "youtube.com", "music")).toEqual({ ok: false, error: "invalid_category" });
    expect(f.writes()).toHaveLength(0);
  });

  it("Missing family fails closed", async () => {
    for (const parents of [{ data: null, error: null }, { data: null, error: DB_ERROR }]) {
      const f = fakeClient({ parents });
      expect(await saveCategoryOverride(f.client, "youtube.com", "education")).toEqual({ ok: false, error: "failed" });
      expect(f.writes()).toHaveLength(0);
    }
  });

  it("Save store failure", async () => {
    const f = fakeClient({ upsert: { data: null, error: DB_ERROR } });
    const result = await saveCategoryOverride(f.client, "youtube.com", "education");
    expect(result).toEqual({ ok: false, error: "failed" });
    expect(JSON.stringify(result)).not.toContain("secret-db-failure-text");
  });

  it("List returns the family's rows sorted", async () => {
    const f = fakeClient({
      select: {
        data: [
          { id: "2", domain: "zeta.com", category: "games" },
          { id: "1", domain: "alpha.com", category: "education" },
        ],
        error: null,
      },
    });
    const result = await listCategoryOverrides(f.client);
    expect(result).toEqual({
      ok: true,
      overrides: [
        { id: "1", domain: "alpha.com", category: "education" },
        { id: "2", domain: "zeta.com", category: "games" },
      ],
    });
    const call = f.calls.find((c) => c.table === "domain_categories");
    const excludesGlobal = call?.ops.some(
      ([m, args]) =>
        (m === "not" && args[0] === "family_id" && args[1] === "is" && args[2] === null) ||
        (m === "neq" && args[0] === "family_id"),
    );
    expect(excludesGlobal).toBe(true);
  });

  it("List failure is not an empty list", async () => {
    const f = fakeClient({ select: { data: null, error: DB_ERROR } });
    expect(await listCategoryOverrides(f.client)).toEqual({ ok: false, error: "failed" });
  });

  it("Remove an override", async () => {
    const f = fakeClient({ delete: { data: [{ id: "ov-1" }], error: null } });
    expect(await removeCategoryOverride(f.client, "ov-1")).toEqual({ ok: true });
    const writes = f.writes();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.ops.some(([m]) => m === "delete")).toBe(true);
    expect(writes[0]?.ops.find(([m, args]) => m === "eq" && args[0] === "id")?.[1][1]).toBe("ov-1");
  });

  it("Remove a missing or foreign override", async () => {
    const f = fakeClient({ delete: { data: [], error: null } });
    expect(await removeCategoryOverride(f.client, "ov-9")).toEqual({ ok: false, error: "not_found" });
  });

  it("Remove store failure", async () => {
    const f = fakeClient({ delete: { data: null, error: DB_ERROR } });
    expect(await removeCategoryOverride(f.client, "ov-1")).toEqual({ ok: false, error: "failed" });
  });
});
