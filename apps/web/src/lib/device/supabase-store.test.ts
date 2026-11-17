import { describe, expect, it, vi } from "vitest";
import { createHeartbeatStore } from "./supabase-store";

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
