import { describe, expect, it, vi } from "vitest";
import { createHeartbeatStore, createRulesStore } from "./supabase-store";

type Client = Parameters<typeof createHeartbeatStore>[0];

function fakeClient(result: unknown = { data: null, error: null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ select, upsert });
  return { client: { from } as unknown as Client, from, select, eq, upsert };
}

describe("createHeartbeatStore", () => {
  it("Store upserts on the primary key", async () => {
    const f = fakeClient();
    const rows = [{ device_id: "dev-1", minute_utc: "2026-11-17T10:03:00.000Z", domain: "youtube.com", seconds: 40 }];
    await createHeartbeatStore(f.client).upsertUsage(rows);
    expect(f.from).toHaveBeenCalledWith("usage_minutes");
    expect(f.upsert).toHaveBeenCalledWith(rows, { onConflict: "device_id,minute_utc,domain" });
  });

  it("Store finds device with rules version", async () => {
    const f = fakeClient({ data: { id: "dev-1", children: { rules_version: 7 } }, error: null });
    expect(await createHeartbeatStore(f.client).findDevice("h")).toEqual({ deviceId: "dev-1", rulesVersion: 7 });
    expect(f.from).toHaveBeenCalledWith("devices");
    expect(f.eq).toHaveBeenCalledWith("token_hash", "h");

    const none = fakeClient({ data: null, error: null });
    expect(await createHeartbeatStore(none.client).findDevice("h")).toBeNull();
  });
});

describe("createRulesStore hours", () => {
  const hoursRow = (start: string | null, end: string | null) => ({
    data: {
      child_id: "child-1",
      children: { family_id: "fam-1", rules_version: 3, allowed_start: start, allowed_end: end, families: { timezone: "UTC" } },
    },
    error: null,
  });

  it("Store maps the columns", async () => {
    const set = await createRulesStore(fakeClient(hoursRow("07:00", "21:00")).client).findChild("h");
    expect(set).toMatchObject({ allowedHours: { start: "07:00", end: "21:00" } });
    const unset = await createRulesStore(fakeClient(hoursRow(null, null)).client).findChild("h");
    expect(unset).toMatchObject({ allowedHours: null });
    const broken = fakeClient({ data: null, error: { message: "boom" } });
    await expect(createRulesStore(broken.client).findChild("h")).rejects.toBeDefined();
  });
});

describe("createRulesStore", () => {
  it("Store maps rows", async () => {
    const device = {
      data: { child_id: "child-1", children: { family_id: "fam-1", rules_version: 3, families: { timezone: "Asia/Ho_Chi_Minh" } } },
      error: null,
    };
    const f = fakeClient(device);
    expect(await createRulesStore(f.client).findChild("h")).toMatchObject({
      childId: "child-1",
      familyId: "fam-1",
      rulesVersion: 3,
      timezone: "Asia/Ho_Chi_Minh",
    });

    const eq = vi.fn().mockResolvedValue({ data: [{ category: "games", minutes_per_day: 60 }], error: null });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const store = createRulesStore({ from } as unknown as Client);
    expect(await store.listLimits("child-1")).toEqual([{ category: "games", minutesPerDay: 60 }]);
    expect(from).toHaveBeenCalledWith("child_category_limits");
    expect(eq).toHaveBeenCalledWith("child_id", "child-1");

    const failing = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const bad = createRulesStore({ from: () => ({ select: () => ({ eq: failing }) }) } as unknown as Client);
    await expect(bad.listLimits("child-1")).rejects.toBeDefined();
  });
});

describe("otherUsage store method", () => {
  type Seen = { table: string; calls: unknown[][] };
  const OVERRIDES = [
    { family_id: "fam-1", domain: "roblox.com", category: "education" },
    { family_id: "fam-2", domain: "youtube.com", category: "games" },
  ];
  const USAGE = [
    { day: "2026-11-17", domain: "roblox.com", seconds: 300 },
    { day: "2026-11-17", domain: "youtube.com", seconds: 60 },
    { day: "2026-11-17", domain: null, seconds: 0 },
  ];

  function client(opts: { rpcError?: boolean; rows?: unknown[] } = {}) {
    const seen: Seen[] = [];
    const rpc = vi.fn(async (name: string, _args: unknown) => {
      if (name !== "device_other_usage" || opts.rpcError) return { data: null, error: { message: "boom" } };
      return { data: opts.rows ?? USAGE, error: null };
    });
    const from = vi.fn((table: string) => {
      const entry: Seen = { table, calls: [] };
      seen.push(entry);
      const builder: Record<string, unknown> = {};
      for (const name of ["select", "eq", "or", "is", "in", "order", "limit"]) {
        builder[name] = (...args: unknown[]) => {
          entry.calls.push([name, ...args]);
          return builder;
        };
      }
      const device = {
        id: "dev-1",
        child_id: "child-1",
        family_id: "fam-1",
        children: { family_id: "fam-1", rules_version: 3, families: { timezone: "UTC" } },
      };
      builder["maybeSingle"] = async () => ({ data: device, error: null });
      builder["single"] = async () => ({ data: device, error: null });
      // Only rows of a family named in a filter come back, like the real query would.
      const page = (rangeFrom: number) => {
        const mentioned = JSON.stringify(entry.calls);
        const rows = OVERRIDES.filter((r) => mentioned.includes(r.family_id));
        return { data: rangeFrom === 0 ? rows : [], error: null };
      };
      builder["range"] = async (rangeFrom: number, to: number) => {
        entry.calls.push(["range", rangeFrom, to]);
        return page(rangeFrom);
      };
      builder["then"] = (resolve: (v: unknown) => void) => resolve(page(0));
      return builder;
    });
    return { client: { from, rpc } as unknown as Client, rpc, seen };
  }

  it("Store maps domains to categories", async () => {
    for (const make of [createHeartbeatStore, createRulesStore]) {
      const f = client();
      const result = await make(f.client).otherUsage("dev-1");
      // roblox.com is a family override (education) 300 s, youtube.com is entertainment by seed 60 s, null row adds 0
      expect(result).toEqual({ day: "2026-11-17", seconds: { education: 300, entertainment: 60 } });
      expect(JSON.stringify(result)).not.toContain(".com");
      expect(f.rpc).toHaveBeenCalledWith("device_other_usage", { p_device_id: "dev-1" });
      const overrides = f.seen.filter((s) => s.table === "domain_categories");
      expect(overrides.length).toBeGreaterThan(0);
      for (const s of overrides) {
        const text = JSON.stringify(s.calls);
        expect(text).toContain("fam-1");
        expect(text).not.toContain("fam-2");
        expect(text).not.toContain("is.null");
        expect(s.calls.some((c) => c[0] === "range")).toBe(true);
      }
    }
  });

  it("Store keeps the day when nothing was used", async () => {
    const f = client({ rows: [{ day: "2026-11-17", domain: null, seconds: 0 }] });
    expect(await createHeartbeatStore(f.client).otherUsage("dev-1")).toEqual({ day: "2026-11-17", seconds: {} });
  });

  it("Store throws on an RPC error", async () => {
    for (const make of [createHeartbeatStore, createRulesStore]) {
      await expect(make(client({ rpcError: true }).client).otherUsage("dev-1")).rejects.toBeDefined();
    }
  });
});
