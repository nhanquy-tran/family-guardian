import { CATEGORIES } from "@fg/shared";
import { describe, expect, it, vi } from "vitest";
import { listDailyLimits, saveDailyLimits } from "./daily-limits";

type Client = Parameters<typeof saveDailyLimits>[0];
type Result = { data?: unknown; error: unknown };
type Call = { table: string; ops: [string, unknown[]][] };
type Results = { upsert?: Result; delete?: Result; select?: Result; throws?: boolean };

const CHILD = "child-1";
const DB_ERROR = { code: "XX000", message: "secret-db-failure-text" };

function fakeClient(results: Results = {}) {
  const calls: Call[] = [];
  const from = vi.fn((table: string) => {
    if (results.throws) throw new Error("network down");
    const call: Call = { table, ops: [] };
    calls.push(call);
    const resolveResult = (): Result => {
      const has = (m: string) => call.ops.some(([op]) => op === m);
      if (has("upsert")) return results.upsert ?? { data: null, error: null };
      if (has("delete")) return results.delete ?? { data: null, error: null };
      return results.select ?? { data: [], error: null };
    };
    const chain: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(resolveResult()).then(resolve, reject),
    };
    for (const method of ["select", "upsert", "delete", "eq", "in", "order"]) {
      chain[method] = (...args: unknown[]) => {
        call.ops.push([method, args]);
        return chain;
      };
    }
    return chain;
  });
  const writes = (op: string) => calls.filter((c) => c.ops.some(([m]) => m === op));
  return { client: { from } as unknown as Client, calls, writes };
}

const allEmpty = () => Object.fromEntries(CATEGORIES.map((c) => [c, ""]));

describe("saveDailyLimits", () => {
  it("Valid values are upserted", async () => {
    const f = fakeClient();
    const res = await saveDailyLimits(f.client, CHILD, { games: "60", entertainment: " 90 ", news: "" });
    expect(res).toEqual({ ok: true });
    const upserts = f.writes("upsert");
    expect(upserts).toHaveLength(1);
    expect(upserts[0].table).toBe("child_category_limits");
    expect(upserts[0].ops.find(([m]) => m === "upsert")![1]).toEqual([
      [
        { child_id: CHILD, category: "games", minutes_per_day: 60 },
        { child_id: CHILD, category: "entertainment", minutes_per_day: 90 },
      ],
      { onConflict: "child_id,category" },
    ]);
    const deletes = f.writes("delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].ops).toContainEqual(["eq", ["child_id", CHILD]]);
    expect(deletes[0].ops).toContainEqual(["in", ["category", ["news"]]]);
  });

  it("Invalid minutes write nothing", async () => {
    for (const bad of ["4", "1441", "abc", "1.5", "-10"]) {
      const f = fakeClient();
      const res = await saveDailyLimits(f.client, CHILD, { news: "30", games: bad });
      expect(res, bad).toEqual({ ok: false, error: "invalid_minutes" });
      expect(f.writes("upsert"), bad).toHaveLength(0);
      expect(f.writes("delete"), bad).toHaveLength(0);
    }
  });

  it("Unknown category writes nothing", async () => {
    const f = fakeClient();
    expect(await saveDailyLimits(f.client, CHILD, { music: "30" })).toEqual({ ok: false, error: "invalid_category" });
    expect(f.calls).toHaveLength(0);
  });

  it("All empty clears the limits", async () => {
    const f = fakeClient({ select: { data: [{ id: CHILD }], error: null } });
    expect(await saveDailyLimits(f.client, CHILD, allEmpty())).toEqual({ ok: true });
    expect(f.writes("upsert")).toHaveLength(0);
    const deletes = f.writes("delete");
    expect(deletes).toHaveLength(1);
    const inOp = deletes[0].ops.find(([m]) => m === "in")!;
    expect([...(inOp[1][1] as string[])].sort()).toEqual([...CATEGORIES].sort());
  });

  it("Clearing limits of a child the parent cannot see", async () => {
    const f = fakeClient({ select: { data: [], error: null } });
    expect(await saveDailyLimits(f.client, CHILD, allEmpty())).toEqual({ ok: false, error: "not_found" });
    expect(f.writes("delete")).toHaveLength(0);
    expect(f.calls[0]?.table).toBe("children");
    expect(f.calls[0]?.ops).toContainEqual(["eq", ["id", CHILD]]);
  });

  it("Store failure returns an error code", async () => {
    const values = { games: "60", news: "" };
    const runs: Results[] = [{ upsert: { error: DB_ERROR } }, { delete: { error: DB_ERROR } }, { throws: true }];
    for (const results of runs) {
      const f = fakeClient(results);
      const res = await saveDailyLimits(f.client, CHILD, values);
      expect(res).toEqual({ ok: false, error: "failed" });
    }
  });
});

describe("listDailyLimits", () => {
  it("List in category order", async () => {
    const f = fakeClient({
      select: {
        data: [
          { category: "news", minutes_per_day: 30 },
          { category: "games", minutes_per_day: 60 },
          { category: "education", minutes_per_day: 120 },
        ],
        error: null,
      },
    });
    const res = await listDailyLimits(f.client, CHILD);
    expect(f.calls[0].table).toBe("child_category_limits");
    expect(f.calls[0].ops).toContainEqual(["eq", ["child_id", CHILD]]);
    expect(res).toEqual({
      ok: true,
      limits: [
        { category: "education", minutesPerDay: 120 },
        { category: "games", minutesPerDay: 60 },
        { category: "news", minutesPerDay: 30 },
      ],
    });
  });

  it("List failure is not an empty list", async () => {
    for (const results of [{ select: { data: null, error: DB_ERROR } }, { throws: true }] as Results[]) {
      const f = fakeClient(results);
      expect(await listDailyLimits(f.client, CHILD)).toEqual({ ok: false, error: "failed" });
    }
  });
});
