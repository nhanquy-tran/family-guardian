import { describe, expect, it } from "vitest";
import { connectionStatus, PAIR_MESSAGES, pairWithCode, STATUS_TEXT } from "./pairing";
import { always, createPost, createStore, entries, sequence } from "./test-fakes";

const ok = { status: 200, body: { deviceToken: "tok-1" } } as const;

function deps(store: ReturnType<typeof createStore>["store"], post: ReturnType<typeof createPost>["post"]) {
  return { baseUrl: "https://fg.example", browser: "edge" as const, os: "Windows", store, post };
}

describe("pairWithCode", () => {
  it("request shape", async () => {
    const { store } = createStore();
    const { post, calls } = always(ok);
    await pairWithCode(deps(store, post), " ab2-cd3 ");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://fg.example/api/device/pair");
    expect(calls[0]?.body).toEqual({ code: "AB2CD3", browser: "edge", os: "Windows" });
    expect(calls[0]?.headers["Content-Type"]).toBe("application/json");
    expect(Object.keys(calls[0]?.headers ?? {}).map((k) => k.toLowerCase())).not.toContain("authorization");
  });

  it("malformed code is not sent", async () => {
    const { store } = createStore();
    const { post, calls } = always(ok);
    expect(await pairWithCode(deps(store, post), "AB2CD0")).toEqual({ ok: false, reason: "invalid_code" });
    expect(await pairWithCode(deps(store, post), "")).toEqual({ ok: false, reason: "invalid_code" });
    expect(calls).toHaveLength(0);
  });

  it("first pairing", async () => {
    const { store, data } = createStore();
    const { post } = always(ok);
    expect(await pairWithCode(deps(store, post), "AB2CD3")).toEqual({ ok: true });
    expect(data.get("deviceToken")).toBe("tok-1");
    expect(data.get("browser")).toBe("edge");
    expect(await connectionStatus(store)).toBe("connected");
  });

  it("re-pairing replaces the old token and its data", async () => {
    const { store, data, ops } = createStore({
      deviceToken: "old",
      queue: entries(1, 2),
      trackerState: { lastAt: null },
    });
    const { post } = always({ status: 200, body: { deviceToken: "tok-2" } });
    await pairWithCode(deps(store, post), "AB2CD3");
    expect(data.get("deviceToken")).toBe("tok-2");
    expect(data.has("queue")).toBe(false);
    expect(data.has("trackerState")).toBe(false);
    const tokenWrite = ops.indexOf("set:deviceToken");
    expect(tokenWrite).toBeGreaterThan(-1);
    expect(ops.indexOf("remove:queue")).toBeLessThan(tokenWrite);
    expect(ops.indexOf("remove:trackerState")).toBeLessThan(tokenWrite);
  });

  it("re-pairing while rejected", async () => {
    const { store, data } = createStore({ deviceToken: "old", authState: "rejected", queue: entries(1, 2) });
    const { post } = always({ status: 200, body: { deviceToken: "tok-2" } });
    await pairWithCode(deps(store, post), "AB2CD3");
    expect(data.get("deviceToken")).toBe("tok-2");
    expect(data.has("authState")).toBe(false);
    expect(data.has("queue")).toBe(false);
    expect(data.has("trackerState")).toBe(false);
    expect(await connectionStatus(store)).toBe("connected");
  });

  it("failed pairing while rejected stays rejected", async () => {
    const queue = entries(1, 2);
    const { store, data } = createStore({ deviceToken: "old", authState: "rejected", queue });
    const { post } = always({ status: 400, body: { error: "invalid_code" } });
    expect(await pairWithCode(deps(store, post), "ZZZZZZ")).toEqual({ ok: false, reason: "invalid_code" });
    expect(data.get("authState")).toBe("rejected");
    expect(data.get("deviceToken")).toBe("old");
    expect(data.get("queue")).toEqual(queue);
  });

  it("store write fails", async () => {
    const { store } = createStore({}, { failSet: true });
    const { post } = always(ok);
    await expect(pairWithCode(deps(store, post), "AB2CD3")).resolves.toEqual({ ok: false, reason: "failed" });
  });

  it("wrong code keeps an existing connection", async () => {
    const queue = entries(1, 2);
    const { store, data } = createStore({ deviceToken: "old", queue });
    const { post } = always({ status: 400, body: { error: "invalid_code" } });
    expect(await pairWithCode(deps(store, post), "ZZZZZZ")).toEqual({ ok: false, reason: "invalid_code" });
    expect(data.get("deviceToken")).toBe("old");
    expect(data.get("queue")).toEqual(queue);
  });

  it("rate limited, server error, bad body, network failure", async () => {
    const { store, data } = createStore({ deviceToken: "old" });
    const { post } = sequence(
      [
        { status: 429, body: { error: "rate_limited" } },
        { status: 500, body: { error: "server_error" } },
        { status: 200, body: { token: "x" } },
      ],
      "network",
    );
    const reasons: string[] = [];
    for (let i = 0; i < 4; i++) {
      const result = await pairWithCode(deps(store, post), "AB2CD3");
      reasons.push(result.ok ? "ok" : result.reason);
    }
    expect(reasons).toEqual(["rate_limited", "failed", "failed", "failed"]);
    expect(data.get("deviceToken")).toBe("old");
  });

  it("Successful re-pair", async () => {
    const { store, data } = createStore({
      deviceToken: "old",
      rulesVersion: 4,
      blockedQueue: [{ at: "2026-11-17T10:00:00.000Z", domain: "tiktok.com" }],
    });
    const { post } = always({ status: 200, body: { deviceToken: "tok-2" } });
    expect(await pairWithCode(deps(store, post), "AB2CD3")).toEqual({ ok: true });
    expect(data.has("rulesVersion")).toBe(false);
    expect(data.has("blockedQueue")).toBe(false);
  });

  it("Failed pair", async () => {
    const blockedQueue = [{ at: "2026-11-17T10:00:00.000Z", domain: "tiktok.com" }];
    const { store, data } = createStore({ deviceToken: "old", rulesVersion: 4, blockedQueue });
    const { post } = always({ status: 400, body: { error: "invalid_code" } });
    expect(await pairWithCode(deps(store, post), "ZZZZZZ")).toEqual({ ok: false, reason: "invalid_code" });
    expect(data.get("rulesVersion")).toBe(4);
    expect(data.get("blockedQueue")).toEqual(blockedQueue);
  });

  it("messages", () => {
    for (const key of ["invalid_code", "rate_limited", "failed", "misconfigured"] as const) {
      const message = PAIR_MESSAGES[key];
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/https?:|token|\b[A-Z0-9]{6}\b/);
    }
  });
});

describe("connectionStatus", () => {
  it("status values", async () => {
    const statuses = [
      await connectionStatus(createStore({ deviceToken: "tok-1" }).store),
      await connectionStatus(createStore().store),
      await connectionStatus(createStore({ deviceToken: "" }).store),
      await connectionStatus(createStore({ deviceToken: 42 }).store),
      await connectionStatus(createStore({ deviceToken: "tok-1" }, { failGet: true }).store),
    ];
    expect(statuses).toEqual(["connected", "not_connected", "not_connected", "not_connected", "not_connected"]);
  });

  it("rejected status", async () => {
    expect(await connectionStatus(createStore({ deviceToken: "tok-1", authState: "rejected" }).store)).toBe("rejected");
    expect(await connectionStatus(createStore({ deviceToken: "tok-1", authState: "x" }).store)).toBe("connected");
    expect(await connectionStatus(createStore({ authState: "rejected" }).store)).toBe("not_connected");
  });

  it("status text", () => {
    expect(STATUS_TEXT.connected).toBe("Connected.");
    expect(STATUS_TEXT.rejected).toBe("Disconnected. Ask your parent to pair this browser again.");
    expect(STATUS_TEXT.not_connected).toBe("Not connected.");
  });
});
