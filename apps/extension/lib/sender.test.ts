import { HeartbeatRequest } from "@fg/shared";
import { describe, expect, it } from "vitest";
import { flushQueue } from "./sender";
import { always, createPost, createStore, entries, entry, NOW, sequence, type Reply } from "./test-fakes";

const ok: Reply = { status: 200, body: { rulesVersion: 3 } };

function run(
  initial: Record<string, unknown>,
  post: ReturnType<typeof createPost>["post"],
  extra: { currentDomain?: string | null; keepAliveOnly?: boolean; failSet?: boolean } = {},
) {
  const fake = createStore(initial, { failSet: extra.failSet });
  const result = flushQueue({
    now: NOW,
    token: "tok-1",
    baseUrl: "https://fg.example",
    browser: "edge",
    extensionVersion: "0.2.0",
    currentDomain: extra.currentDomain ?? null,
    keepAliveOnly: extra.keepAliveOnly ?? false,
    store: fake.store,
    post,
  });
  return { result, data: fake.data };
}

const two = [
  { at: "2026-11-17T09:00:00.000Z", domain: "tiktok.com" },
  { at: "2026-11-17T09:30:00.000Z", domain: "roblox.com" },
];

const sent = (call: { body: Record<string, unknown> } | undefined) => call?.body["entries"];

describe("flushQueue", () => {
  it("request shape", async () => {
    const { post, calls } = always(ok);
    await run({ queue: entries(1, 2) }, post, { currentDomain: "youtube.com" }).result;
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://fg.example/api/device/heartbeat");
    expect(calls[0]?.headers).toEqual({ Authorization: "Bearer tok-1", "Content-Type": "application/json" });
    expect(Object.keys(calls[0]?.body ?? {}).sort()).toEqual(["browser", "currentDomain", "entries", "extensionVersion"]);
    expect(() => HeartbeatRequest.parse(calls[0]?.body)).not.toThrow();
    expect(calls[0]?.body).toEqual({
      entries: [entry(1), entry(2)],
      currentDomain: "youtube.com",
      browser: "edge",
      extensionVersion: "0.2.0",
    });
  });

  it("three chunks", async () => {
    const { post, calls } = always(ok);
    const { result, data } = run({ queue: entries(1, 3000) }, post);
    expect(await result).toEqual({ kind: "ok", rulesVersion: 3 });
    expect(calls.map((c) => (sent(c) as unknown[]).length)).toEqual([1440, 1440, 120]);
    expect(sent(calls[0])).toEqual(entries(1, 1440));
    expect(sent(calls[1])).toEqual(entries(1441, 2880));
    expect(sent(calls[2])).toEqual(entries(2881, 3000));
    expect(data.get("queue")).toEqual([]);
  });

  it("queue saved after each chunk", async () => {
    const { post, calls } = sequence([ok], "network");
    const { result, data } = run({ queue: entries(1, 3000) }, post);
    expect(await result).toEqual({ kind: "failed" });
    expect(calls).toHaveLength(2);
    expect(data.get("queue")).toEqual(entries(1441, 3000));
  });

  it("empty queue still sends a keep-alive", async () => {
    const { post, calls } = always(ok);
    const { result } = run({ queue: [] }, post);
    expect(await result).toEqual({ kind: "ok", rulesVersion: 3 });
    expect(calls).toHaveLength(1);
    expect(sent(calls[0])).toEqual([]);
  });

  it("pruned before sending", async () => {
    const old = { minuteUtc: "2026-11-10T10:04:00.000Z", domain: "a.com", seconds: 30 };
    const recent = { minuteUtc: "2026-11-17T10:04:00.000Z", domain: "a.com", seconds: 30 };
    const { post, calls } = always(ok);
    await run({ queue: [old, recent] }, post).result;
    expect(calls).toHaveLength(1);
    expect(sent(calls[0])).toEqual([recent]);
  });

  it("split after 413", async () => {
    const { post, calls } = sequence([{ status: 413, body: { error: "too_many_entries" } }], ok);
    const { result, data } = run({ queue: entries(1, 1440) }, post);
    await result;
    expect(calls.map((c) => (sent(c) as unknown[]).length)).toEqual([1440, 720, 720]);
    expect(sent(calls[1])).toEqual(entries(1, 720));
    expect(sent(calls[2])).toEqual(entries(721, 1440));
    expect(data.get("queue")).toEqual([]);
  });

  it("split uses the length actually sent", async () => {
    const { post, calls } = sequence([{ status: 413, body: { error: "too_many_entries" } }], ok);
    await run({ queue: entries(1, 3) }, post).result;
    expect(calls.map((c) => sent(c))).toEqual([entries(1, 3), [entry(1)], [entry(2)], [entry(3)]]);
  });

  it("413 for a single entry stops", async () => {
    const { post, calls } = always({ status: 413, body: { error: "too_many_entries" } });
    const { result, data } = run({ queue: [entry(1)] }, post);
    expect(await result).toEqual({ kind: "failed" });
    expect(calls).toHaveLength(1);
    expect(data.get("queue")).toEqual([entry(1)]);
  });

  it("server and network failures", async () => {
    const replies: Reply[] = [
      { status: 400, body: { error: "invalid_request" } },
      { status: 500, body: { error: "server_error" } },
      { status: 503, nonJson: true },
      { status: 200, body: { ok: true } },
      "network",
    ];
    for (const reply of replies) {
      const { post, calls } = always(reply);
      const { result, data } = run({ queue: [entry(1), entry(2)] }, post);
      expect(await result).toEqual({ kind: "failed" });
      expect(calls).toHaveLength(1);
      expect(data.get("queue")).toEqual([entry(1), entry(2)]);
    }
  });

  it("store write fails after 200", async () => {
    const { post, calls } = always(ok);
    const { result } = run({ queue: entries(1, 3000) }, post, { failSet: true });
    await expect(result).resolves.toEqual({ kind: "failed" });
    expect(calls).toHaveLength(1);
  });

  it("401 returns unauthorized and keeps the queue", async () => {
    const { post, calls } = always({ status: 401, body: { error: "unauthorized" } });
    const { result, data } = run({ queue: entries(1, 2) }, post);
    expect(await result).toEqual({ kind: "unauthorized" });
    expect(calls).toHaveLength(1);
    expect(data.get("queue")).toEqual(entries(1, 2));
  });

  it("Attempts included and cleared", async () => {
    const { post, calls } = always(ok);
    const { result, data } = run({ queue: [], blockedQueue: two }, post);
    await result;
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body["blocked"]).toEqual(two);
    expect(() => HeartbeatRequest.parse(calls[0]?.body)).not.toThrow();
    expect(data.get("blockedQueue")).toEqual([]);
  });

  it("No attempts, no key", async () => {
    const { post, calls } = always(ok);
    await run({ queue: entries(1, 2), blockedQueue: [] }, post).result;
    expect(Object.keys(calls[0]?.body ?? {}).sort()).toEqual([
      "browser",
      "currentDomain",
      "entries",
      "extensionVersion",
    ]);
  });

  it("Failure keeps attempts", async () => {
    const replies: Reply[] = [
      { status: 500, body: { error: "server_error" } },
      { status: 401, body: { error: "unauthorized" } },
      { status: 413, body: { error: "too_many_entries" } },
      "network",
    ];
    for (const reply of replies) {
      const { post } = always(reply);
      const { result, data } = run({ queue: [], blockedQueue: two }, post);
      await result;
      expect(data.get("blockedQueue")).toEqual(two);
    }
  });

  it("Only the first chunk carries attempts", async () => {
    const { post, calls } = always(ok);
    const { result, data } = run({ queue: entries(1, 1441), blockedQueue: [two[0]] }, post);
    await result;
    expect(calls).toHaveLength(2); // 1441 entries = chunks of 1440 + 1
    expect(calls[0]?.body["blocked"]).toEqual([two[0]]);
    expect(Object.keys(calls[1]?.body ?? {})).not.toContain("blocked");
    expect(data.get("blockedQueue")).toEqual([]);
  });

  it("Keep-alive carries none", async () => {
    const { post, calls } = always(ok);
    const { result, data } = run({ queue: [], blockedQueue: [two[0]] }, post, { keepAliveOnly: true });
    await result;
    expect(calls).toHaveLength(1);
    expect(Object.keys(calls[0]?.body ?? {})).not.toContain("blocked");
    expect(data.get("blockedQueue")).toEqual([two[0]]);
  });

  it("keep-alive only leaves the queue untouched", async () => {
    const { post, calls } = always(ok);
    const { result, data } = run({ queue: entries(1, 2) }, post, { keepAliveOnly: true });
    expect(await result).toEqual({ kind: "ok", rulesVersion: 3 });
    expect(calls).toHaveLength(1);
    expect(sent(calls[0])).toEqual([]);
    expect(data.get("queue")).toEqual(entries(1, 2));
  });
});

describe("flushQueue other usage", () => {
  const withOther = (games: number): Reply => ({
    status: 200,
    body: { rulesVersion: 3, otherUsage: { day: "2026-11-17", seconds: { games } } },
  });

  it("Several chunks use the last 200 response", async () => {
    const { post, calls } = sequence([withOther(60), withOther(120)], withOther(180));
    const { result } = run({ queue: entries(1, 3000) }, post);
    expect(await result).toEqual({
      kind: "ok",
      rulesVersion: 3,
      otherUsage: { day: "2026-11-17", seconds: { games: 180 } },
    });
    expect(calls).toHaveLength(3);
  });

  it("A keep-alive carries it too, an invalid value is dropped", async () => {
    const a = run({ queue: [] }, always(withOther(90)).post);
    expect(await a.result).toEqual({ kind: "ok", rulesVersion: 3, otherUsage: { day: "2026-11-17", seconds: { games: 90 } } });
    const bad: Reply = { status: 200, body: { rulesVersion: 3, otherUsage: { day: "x", seconds: { games: -5 } } } };
    const b = run({ queue: [] }, always(bad).post);
    const result = await b.result;
    expect(result).toMatchObject({ kind: "ok", rulesVersion: 3 });
    expect(result).not.toHaveProperty("otherUsage");
  });
});
