import { CATEGORIES, HeartbeatResponse, OtherUsage } from "@fg/shared";
import { describe, expect, it, vi } from "vitest";
import { createController } from "../../apps/extension/lib/controller";
import { flushQueue } from "../../apps/extension/lib/sender";
import { always, at, createDnr, createGet, createPost, createStore, entries, sequence } from "../../apps/extension/lib/test-fakes";
import { handleHeartbeat, type HeartbeatStore } from "../../apps/web/src/lib/device/heartbeat";
import { hashDeviceToken } from "../../apps/web/src/lib/device/token";

const paired = { deviceToken: "tok-9", rulesVersion: 7, rulesDomains: [] };

function build(initial: Record<string, unknown>, post: ReturnType<typeof createPost>["post"]) {
  const fake = createStore(initial);
  const box = createDnr();
  const badge = {
    setBadgeText: vi.fn(async (_d: { text: string }) => undefined),
    setBadgeBackgroundColor: vi.fn(async (_d: { color: string }) => undefined),
  };
  const controller = createController({
    store: fake.store,
    post,
    get: createGet(() => "network").get,
    dnr: box.dnr,
    badge,
    baseUrl: "https://fg.example",
    extensionVersion: "0.3.0",
    os: "Windows",
    log: () => undefined,
  });
  return { ...fake, controller, rules: box.rules, badge };
}

const reply = (extra: Record<string, unknown>) => always({ status: 200, body: { rulesVersion: 7, ...extra } }).post;
const blockedPaths = (rules: unknown[]) =>
  (rules as { action: { redirect: { extensionPath: string } } }[]).map((r) => r.action.redirect.extensionPath);

describe("acceptance: limits add the other browsers' usage", () => {
  const limits = [{ category: "games", minutesPerDay: 10 }];
  const local = (seconds: number) => ({ day: "2026-11-17", seconds: { games: seconds }, domains: { "roblox.com": "games" } });

  it("acceptance: exact boundary in another timezone, and stale days", async () => {
    // America/Los_Angeles at 2026-11-17T10:00:05Z is 02:00 on 2026-11-17; limit 10 * 60 = 600 s
    const cases: [number, string, boolean][] = [
      [200, "2026-11-17", true], // 400 + 200 = 600
      [199, "2026-11-17", false], // 599
      [900, "2026-11-16", false], // yesterday counts as empty
    ];
    for (const [other, day, blocked] of cases) {
      const t = build(
        { ...paired, rulesLimits: limits, rulesTimezone: "America/Los_Angeles", limitUsage: local(400), otherUsage: { day, seconds: { games: other } } },
        reply({}),
      );
      await t.controller.onAlarm(at("10:00:05"));
      expect(blockedPaths(t.rules()).includes("/blocked.html?d=roblox.com&c=games"), `${other} ${day}`).toBe(blocked);
    }
  });

  it("acceptance: badge counts the other browser and ignores a stale day", async () => {
    const run = async (day: string) => {
      const t = build(
        { ...paired, rulesLimits: limits, rulesTimezone: "UTC", limitUsage: local(0), otherUsage: { day, seconds: { games: 540 } } },
        reply({}),
      );
      await t.controller.handleEvent({ type: "tab", at: at("10:00:00"), url: "https://www.roblox.com/x" });
      const texts = t.badge.setBadgeText.mock.calls.map((c) => c[0].text);
      return texts[texts.length - 1];
    };
    // 600 - 540 = 60 s = 1 minute left
    expect(await run("2026-11-17")).toBe("1");
    // 600 s left is more than five minutes
    expect(await run("2026-11-16")).toBe("");
  });
});

describe("acceptance: the contract", () => {
  it("acceptance: every category is allowed, domains and bad numbers are not", () => {
    const all = Object.fromEntries(CATEGORIES.map((c, i) => [c, i * 30]));
    expect(OtherUsage.safeParse({ day: "2026-01-05", seconds: all }).success).toBe(true);
    expect(OtherUsage.safeParse({ day: "2026-01-05", seconds: {} }).success).toBe(true);
    expect(OtherUsage.safeParse({ day: "2026-01-05", seconds: { games: 0 } }).success).toBe(true);
    for (const bad of [
      { day: "2026-1-5", seconds: {} },
      { day: "2026-01-05", seconds: { games: Number.NaN } },
      { day: "2026-01-05", seconds: { games: "60" } },
      { day: "2026-01-05", seconds: { "youtube.com": 5 } },
      { day: "2026-01-05" },
      null,
    ]) {
      expect(OtherUsage.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
    expect(HeartbeatResponse.safeParse({ rulesVersion: 2, otherUsage: "junk" }).success).toBe(true);
  });
});

describe("acceptance: the heartbeat handler", () => {
  function store(other: () => Promise<unknown>): HeartbeatStore {
    return {
      findDevice: async (hash) => (hash === hashDeviceToken("tok-9") ? { deviceId: "dev-9", rulesVersion: 11 } : null),
      upsertUsage: async () => undefined,
      insertBlocked: async () => undefined,
      updateDevice: async () => undefined,
      otherUsage: other as HeartbeatStore["otherUsage"],
    };
  }
  const send = (s: HeartbeatStore) =>
    handleHeartbeat({
      authorization: "Bearer tok-9",
      rawBody: JSON.stringify({ entries: [], currentDomain: null, browser: "brave", extensionVersion: "1.0.0" }),
      now: new Date("2026-03-02T08:00:30Z"),
      store: s,
      log: () => undefined,
    });

  it("acceptance: several categories are returned for the calling device only, nothing else leaks", async () => {
    const value = { day: "2026-03-02", seconds: { games: 5, education: 3600, social: 0 } };
    const other = vi.fn(async (_id: string) => value);
    const res = await send(store(other));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rulesVersion: 11, otherUsage: value });
    expect(other).toHaveBeenCalledWith("dev-9");
  });

  it("acceptance: failures and bad values never change the status or the version", async () => {
    for (const make of [
      async () => {
        throw new Error("rpc down");
      },
      async () => ({ day: "2026-03-02", seconds: { games: 1.5 } }),
      async () => ({ day: "2026-03-02", seconds: { "roblox.com": 60 } }),
      async () => null,
    ]) {
      const res = await send(store(make));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ rulesVersion: 11 });
    }
  });
});

describe("acceptance: flushing keeps the last value across a split batch", () => {
  it("acceptance: 413 halving then 200s returns the last 200's other usage", async () => {
    const good = (games: number) => ({ status: 200, body: { rulesVersion: 7, otherUsage: { day: "2026-11-17", seconds: { games } } } }) as const;
    // 1500 entries: the first request (1440) gets 413, the size halves to 720: chunks 720 + 720 + 60 get three 200s, the last wins
    const { post } = sequence([{ status: 413, body: { error: "too_many_entries" } }, good(10), good(20)], good(30));
    const fake = createStore({ queue: entries(1, 1500) });
    const result = await flushQueue({
      now: Date.parse("2026-11-17T10:05:30Z"),
      token: "tok-9",
      baseUrl: "https://fg.example",
      browser: "chrome",
      extensionVersion: "0.3.0",
      currentDomain: null,
      keepAliveOnly: false,
      store: fake.store,
      post,
    });
    expect(result).toEqual({ kind: "ok", rulesVersion: 7, otherUsage: { day: "2026-11-17", seconds: { games: 30 } } });
  });
});
