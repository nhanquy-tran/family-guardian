import { describe, expect, it, vi } from "vitest";
import { handleHeartbeat, type HeartbeatStore } from "./heartbeat";
import { hashDeviceToken } from "./token";

const NOW = new Date("2026-11-17T10:05:30Z");
const GOOD = { day: "2026-11-17", seconds: { games: 600 } };

function fakeStore(other: () => Promise<unknown>) {
  const upsertUsage = vi.fn(async () => {});
  const otherUsage = vi.fn(async (_deviceId: string) => other());
  const store: HeartbeatStore = {
    findDevice: async (hash) => (hash === hashDeviceToken("tok-1") ? { deviceId: "dev-1", rulesVersion: 3 } : null),
    upsertUsage,
    insertBlocked: async () => {},
    updateDevice: async () => {},
    otherUsage,
  };
  return { store, upsertUsage, otherUsage };
}

const body = {
  entries: [{ minuteUtc: "2026-11-17T10:03:00.000Z", domain: "youtube.com", seconds: 40 }],
  currentDomain: null,
  browser: "edge",
  extensionVersion: "0.2.0",
};

const call = (store: HeartbeatStore) =>
  handleHeartbeat({ authorization: "Bearer tok-1", rawBody: JSON.stringify(body), now: NOW, store, log: () => {} });

describe("heartbeat other usage", () => {
  it("Other device seconds by category", async () => {
    const f = fakeStore(async () => GOOD);
    const res = await call(f.store);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rulesVersion: 3, otherUsage: GOOD });
    expect(f.otherUsage).toHaveBeenCalledWith("dev-1");
    expect(JSON.stringify(res.body)).not.toMatch(/\.com/);
  });

  it("Computation fails", async () => {
    const f = fakeStore(async () => {
      throw new Error("db down");
    });
    const res = await call(f.store);
    expect(res).toEqual({ status: 200, body: { rulesVersion: 3 } });
    expect(f.upsertUsage).toHaveBeenCalledTimes(1);
  });

  it("Invalid value is omitted", async () => {
    const f = fakeStore(async () => ({ day: "x", seconds: { games: -1 } }));
    const res = await call(f.store);
    expect(res).toEqual({ status: 200, body: { rulesVersion: 3 } });
    expect(res.body).not.toHaveProperty("otherUsage");
  });
});
