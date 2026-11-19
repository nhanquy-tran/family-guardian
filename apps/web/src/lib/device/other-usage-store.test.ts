import { describe, expect, it, vi } from "vitest";
import { createHeartbeatStore } from "./supabase-store";

type Client = Parameters<typeof createHeartbeatStore>[0];

const OVERRIDES = [
  { family_id: "fam-1", domain: "roblox.com", category: "education" },
  { family_id: "fam-2", domain: "youtube.com", category: "news" },
];

// Chainable query fake: records eq filters and answers range() with the rows matching them.
function fakeClient(rpcResult: unknown) {
  const eqs: [string, unknown][] = [];
  const tables: string[] = [];
  const ranges: [number, number][] = [];
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const from = vi.fn((table: string) => {
    tables.push(table);
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain["select"] = self;
    chain["or"] = self;
    chain["limit"] = self;
    chain["eq"] = (col: string, val: unknown) => {
      eqs.push([col, val]);
      return chain;
    };
    chain["range"] = async (a: number, b: number) => {
      ranges.push([a, b]);
      const family = eqs.find(([c]) => c === "family_id")?.[1];
      return { data: OVERRIDES.filter((r) => family === undefined || r.family_id === family).slice(a, b + 1), error: null };
    };
    const device = { id: "dev-1", child_id: "child-1", children: { family_id: "fam-1", families: { timezone: "UTC" } } };
    chain["maybeSingle"] = async () => ({ data: device, error: null });
    chain["single"] = async () => ({ data: device, error: null });
    return chain;
  });
  return { client: { from, rpc } as unknown as Client, rpc, tables, ranges, eqs };
}

describe("other usage store", () => {
  it("Store maps domains to categories", async () => {
    const rows = [
      { day: "2026-11-17", domain: "roblox.com", seconds: 300 },
      { day: "2026-11-17", domain: "youtube.com", seconds: 60 },
      { day: "2026-11-17", domain: null, seconds: 0 },
    ];
    const f = fakeClient({ data: rows, error: null });
    const result = await createHeartbeatStore(f.client).otherUsage?.("dev-1");
    expect(f.rpc.mock.calls[0]?.[0]).toBe("device_other_usage");
    // roblox.com is a family override (education); youtube.com falls back to the seed (entertainment)
    expect(result).toEqual({ day: "2026-11-17", seconds: { education: 300, entertainment: 60 } });
    expect(JSON.stringify(result)).not.toContain(".com");
    expect(f.ranges.length).toBeGreaterThan(0);
    expect(f.eqs).toContainEqual(["family_id", "fam-1"]);
    expect(f.eqs).not.toContainEqual(["family_id", "fam-2"]);

    const broken = fakeClient({ data: null, error: { message: "boom" } });
    await expect(createHeartbeatStore(broken.client).otherUsage?.("dev-1") ?? Promise.resolve()).rejects.toBeDefined();
  });
});
