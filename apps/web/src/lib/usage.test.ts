import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UsageView } from "../app/dashboard/usage/[childId]/usage-view";
import { barSegments, formatDuration, loadUsage } from "./usage";

type Client = Parameters<typeof loadUsage>[0];
type Result = { data: unknown; error: unknown };
type RpcCall = { name: string; args: unknown; from: number; to: number };

const INPUT = { childId: "child-1", tz: "UTC", view: "week" as const, today: "2026-03-14" };
const OK: Result = { data: [], error: null };
const FOUND: Result = { data: { id: "child-1" }, error: null };

/**
 * Fake Supabase client. The child lookup resolves `child`; every rpc(...).order(...).range(from, to)
 * is answered by `page(call)`. An rpc() chain without .range() never resolves, so reads must use
 * explicit ranges.
 */
function fakeClient(child: Result, page: (call: RpcCall) => Result, categories: Result = OK) {
  const rpcCalls: RpcCall[] = [];
  const from = vi.fn((table?: string) => {
    const own = table === "domain_categories" ? categories : child;
    const chain: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown) => resolve(own),
      maybeSingle: () => Promise.resolve(own),
      single: () => Promise.resolve(own),
    };
    for (const m of ["select", "eq", "is", "not", "or", "order"]) chain[m] = () => chain;
    return chain;
  });
  const rpc = vi.fn((name: string, args: unknown) => {
    const chain: Record<string, unknown> = {};
    chain.order = () => chain;
    chain.range = (a: number, b: number) => {
      const call = { name, args, from: a, to: b };
      rpcCalls.push(call);
      return Promise.resolve(page(call));
    };
    return chain;
  });
  return { client: { from, rpc } as unknown as Client, rpc, rpcCalls };
}

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ day: "2026-03-14", domain: `s${i}.com`, seconds: 1 }));

describe("Usage data loading and access", () => {
  it("Child of another family", async () => {
    const f = fakeClient({ data: null, error: null }, () => OK);
    expect(await loadUsage(f.client, INPUT)).toEqual({ status: "not-found" });
    expect(f.rpc).not.toHaveBeenCalled();
  });

  it("More than 1000 rows", async () => {
    const f = fakeClient(FOUND, (c) => {
      if (c.name !== "usage_by_day") return OK;
      if (c.from === 0 && c.to === 999) return { data: rows(1000), error: null };
      if (c.from === 1000 && c.to === 1999) return { data: rows(250), error: null };
      return OK;
    });
    const result = await loadUsage(f.client, INPUT);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.days).toHaveLength(1250); // 1000 + 250
    const byDay = f.rpcCalls.filter((c) => c.name === "usage_by_day").map((c) => [c.from, c.to]);
    expect(byDay).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("Child lookup failure", async () => {
    const f = fakeClient({ data: null, error: { message: "boom" } }, () => OK);
    expect(await loadUsage(f.client, INPUT)).toEqual({ status: "error" });
    expect(f.rpc).not.toHaveBeenCalled();
  });

  it("Aggregation call failure", async () => {
    for (const [view, failing] of [
      ["week", "usage_by_day"],
      ["today", "usage_by_day"],
      ["today", "usage_timeline"],
    ] as const) {
      const f = fakeClient(FOUND, (c) =>
        c.name === failing ? { data: null, error: { message: "boom" } } : { data: rows(3), error: null },
      );
      const result = await loadUsage(f.client, { ...INPUT, view });
      expect(result, `${view} ${failing}`).toEqual({ status: "error" });
    }
  });

  it("Failure on a later page", async () => {
    const f = fakeClient(FOUND, (c) =>
      c.from === 0 ? { data: rows(1000), error: null } : { data: null, error: { message: "boom" } },
    );
    const result = await loadUsage(f.client, INPUT);
    expect(result).toEqual({ status: "error" });
    expect(JSON.stringify(result)).not.toContain("s0.com");
  });

  it("Overrides query failure shows the usage error", async () => {
    const f = fakeClient(FOUND, () => ({ data: rows(3), error: null }), { data: null, error: { message: "boom" } });
    const result = await loadUsage(f.client, INPUT);
    expect(result).toEqual({ status: "error" });
    expect(JSON.stringify(result)).not.toContain("s0.com");
  });

  it("Error state shown", () => {
    const html = renderToStaticMarkup(
      createElement(UsageView, { result: { status: "error" }, view: "today", tz: "UTC", today: "2026-03-14" }),
    );
    expect(html).toContain("Could not load usage. Try again.");
    for (const word of ["Top sites", "Total", "min", "Entertainment"]) expect(html).not.toContain(word);
  });
});

describe("Presentation", () => {
  it("Duration formatting", () => {
    expect(formatDuration(3900)).toBe("1 h 05 min"); // 3900 s = 65 min = 1 h 5 min
    expect(formatDuration(420)).toBe("7 min"); // 420 s = 7 min
  });

  it("Bar segments", () => {
    const byCategory: Parameters<typeof barSegments>[0] = {
      education: 300,
      entertainment: 600,
      social: 0,
      games: 0,
      news: 0,
      shopping: 0,
      communication: 0,
      productivity: 0,
      other: 0,
    };
    const segments = barSegments(byCategory, 1800);
    // 600/1800 = 33.3 % ; 300/1800 = 16.7 % ; CATEGORIES order puts education before entertainment
    expect(segments.map((s) => s.category)).toEqual(["education", "entertainment"]);
    expect(segments[0]!.widthPercent).toBeCloseTo(16.7, 1);
    expect(segments[1]!.widthPercent).toBeCloseTo(33.3, 1);
  });
});
