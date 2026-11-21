import { HeartbeatRequest } from "@fg/shared";
import { describe, expect, it, vi } from "vitest";
import { createController, registerSchedule } from "./controller";
import { connectionStatus } from "./pairing";
import { limitBlockDomains } from "./limits";
import { buildRules, syncRules } from "./rules";
import {
  always,
  at,
  type Call,
  createDnr,
  createGet,
  createPost,
  createStore,
  deferred,
  entries,
  type Reply,
} from "./test-fakes";
import { createTracker, type TrackerEvent } from "./tracker";

const ok: Reply = { status: 200, body: { rulesVersion: 3 } };
const unauthorized: Reply = { status: 401, body: { error: "unauthorized" } };
const paired = { deviceToken: "tok-1" };

const noRules = () => createGet(() => "network");

function setup(
  initial: Record<string, unknown>,
  post: ReturnType<typeof createPost>["post"],
  rules: { get?: ReturnType<typeof createGet>["get"]; dnr?: ReturnType<typeof createDnr>["dnr"] } = {},
) {
  const fake = createStore(initial);
  const log = vi.fn<(message: string) => void>();
  const controller = createController({
    store: fake.store,
    post,
    get: rules.get ?? noRules().get,
    dnr: rules.dnr ?? createDnr().dnr,
    baseUrl: "https://fg.example",
    extensionVersion: "0.2.0",
    os: "Windows",
    log,
  });
  return { ...fake, controller, log };
}

async function track(
  controller: { handleEvent(e: TrackerEvent): Promise<void> },
  time: string,
  url: string | null,
  extra: { focused?: boolean } = {},
) {
  await controller.handleEvent({ type: "focus", at: at(time), focused: extra.focused ?? true });
  await controller.handleEvent({ type: "idle", at: at(time), state: "active" });
  await controller.handleEvent({ type: "tab", at: at(time), url });
}

const heartbeats = (calls: Call[]) => calls.filter((c) => c.url.endsWith("/api/device/heartbeat"));
const settle = () => new Promise((r) => setTimeout(r, 15));

describe("registerSchedule", () => {
  it("schedule registered", () => {
    const alarms = { create: vi.fn() };
    const idle = { setDetectionInterval: vi.fn() };
    registerSchedule({ alarms, idle });
    expect(alarms.create).toHaveBeenCalledWith("heartbeat", { periodInMinutes: 1 });
    expect(idle.setDetectionInterval).toHaveBeenCalledWith(60);
  });
});

describe("controller while paired", () => {
  it("completed minute is sent", async () => {
    const { post, calls } = always(ok);
    const { controller, data } = setup(paired, post);
    await track(controller, "10:03:00", "https://www.youtube.com/");
    await controller.onAlarm(at("10:04:05"));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body["entries"]).toContainEqual({
      minuteUtc: "2026-11-17T10:03:00.000Z",
      domain: "youtube.com",
      seconds: 60,
    });
    expect(calls[0]?.body["currentDomain"]).toBe("youtube.com");
    expect(data.get("queue")).toEqual([]);
  });

  it("current domain null when not active", async () => {
    const { post, calls } = always(ok);
    const { controller } = setup(paired, post);
    await track(controller, "10:03:00", "https://www.youtube.com/");
    await controller.handleEvent({ type: "focus", at: at("10:03:30"), focused: false });
    await controller.onAlarm(at("10:04:05"));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body["currentDomain"]).toBeNull();
  });

  it("not paired", async () => {
    const { post, calls } = always(ok);
    const { controller, data } = setup({}, post);
    await track(controller, "10:03:00", "https://www.youtube.com/");
    await controller.onAlarm(at("10:04:05"));
    expect(calls).toHaveLength(0);
    expect(data.size).toBe(0);
  });

  it("offline minutes are queued and sent later in order", async () => {
    let online = false;
    const { post, calls } = createPost(() => (online ? ok : "network"));
    const { controller, data } = setup(paired, post);
    await track(controller, "10:00:00", "https://khanacademy.org/");
    for (const t of ["10:01:05", "10:02:05", "10:03:05"]) await controller.onAlarm(at(t));
    online = true;
    await controller.onAlarm(at("10:04:05"));
    const last = calls[calls.length - 1];
    expect(last?.body["entries"]).toEqual(
      ["10:00", "10:01", "10:02", "10:03"].map((m) => ({
        minuteUtc: `2026-11-17T${m}:00.000Z`,
        domain: "khanacademy.org",
        seconds: 60,
      })),
    );
    expect(data.get("queue")).toEqual([]);
  });

  it("tracker state survives a service-worker restart", async () => {
    const { post, calls } = always(ok);
    const first = setup(paired, post);
    await track(first.controller, "10:03:00", "https://khanacademy.org/");
    const second = createController({
      store: first.store,
      post,
      get: noRules().get,
      dnr: createDnr().dnr,
      baseUrl: "https://fg.example",
      extensionVersion: "0.2.0",
      os: "Windows",
      log: vi.fn(),
    });
    await second.onAlarm(at("10:04:05"));
    expect(calls[0]?.body["entries"]).toContainEqual({
      minuteUtc: "2026-11-17T10:03:00.000Z",
      domain: "khanacademy.org",
      seconds: 60,
    });
  });

  it("no URL leaves the device", async () => {
    const { post, calls } = always(ok);
    const { controller, data } = setup(paired, post);
    await track(controller, "10:03:10", "https://www.youtube.com/watch?v=abc&t=10");
    await controller.onAlarm(at("10:04:05"));
    const bodies = calls.map((c) => c.raw).join("\n");
    const stored = JSON.stringify([...data.entries()]);
    for (const text of [bodies, stored]) {
      for (const forbidden of ["https://", "/watch", "v=abc", "www.youtube.com"]) {
        expect(text).not.toContain(forbidden);
      }
    }
    expect(calls[0]?.body["entries"]).toContainEqual(expect.objectContaining({ domain: "youtube.com" }));
  });
});

describe("controller rejected (401)", () => {
  it("first 401", async () => {
    const { post, calls } = always(unauthorized);
    const { controller, data, store } = setup({ ...paired, queue: entries(1, 2) }, post);
    await controller.onAlarm(at("10:04:05"));
    expect(calls).toHaveLength(1);
    expect(data.get("deviceToken")).toBe("tok-1");
    expect(data.get("queue")).toEqual(entries(1, 2));
    expect(data.get("authState")).toBe("rejected");
    expect(await connectionStatus(store)).toBe("rejected");
  });

  it("rejected device stops tracking", async () => {
    const { post, calls } = always(ok);
    const trackerState = createTracker();
    const { controller, data } = setup({ ...paired, authState: "rejected", trackerState }, post);
    await track(controller, "10:00:30", "https://www.youtube.com/");
    await controller.onAlarm(at("10:01:05"));
    await controller.onAlarm(at("10:02:05"));
    expect(calls).toHaveLength(0);
    expect(data.has("queue") ? data.get("queue") : []).toEqual([]);
    expect(data.get("trackerState")).toEqual(trackerState);
  });

  it("retry every 15 minutes with an empty body", async () => {
    const { post, calls } = always(unauthorized);
    const { controller, data } = setup(
      { ...paired, authState: "rejected", queue: entries(1, 2) },
      post,
    );
    for (const t of ["10:14:05", "10:15:05", "10:16:05", "10:30:05"]) await controller.onAlarm(at(t));
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.body["entries"]).toEqual([]);
      expect(call.body["currentDomain"]).toBeNull();
    }
    expect(data.get("deviceToken")).toBe("tok-1");
    expect(data.get("queue")).toEqual(entries(1, 2));
    expect(data.get("authState")).toBe("rejected");
  });

  it("recovery on 200", async () => {
    const { post, calls } = always(ok);
    const { controller, data } = setup(
      { ...paired, authState: "rejected", queue: entries(1, 2), trackerState: createTracker() },
      post,
    );
    await controller.onAlarm(at("10:15:05"));
    expect(data.has("authState")).toBe(false);
    expect(data.has("trackerState")).toBe(false);
    expect(data.get("deviceToken")).toBe("tok-1");
    await controller.onAlarm(at("10:16:05"));
    expect(calls[calls.length - 1]?.body["entries"]).toEqual(entries(1, 2));
    expect(data.get("queue")).toEqual([]);
  });

  it("pruning continues while rejected", async () => {
    const old = { minuteUtc: "2026-11-10T10:00:00.000Z", domain: "a.com", seconds: 30 };
    const recent = { minuteUtc: "2026-11-17T10:04:00.000Z", domain: "a.com", seconds: 30 };
    const { post } = always(ok);
    const { controller, data } = setup({ ...paired, authState: "rejected", queue: [old, recent] }, post);
    await controller.onAlarm(at("10:01:05"));
    expect(data.get("queue")).toEqual([recent]);
  });

  it("re-pair while rejected", async () => {
    const { post, calls } = createPost((call) =>
      call.url.endsWith("/api/device/pair") ? { status: 200, body: { deviceToken: "tok-2" } } : ok,
    );
    const { controller, data } = setup(
      { deviceToken: "old", authState: "rejected", queue: entries(1, 2) },
      post,
    );
    await controller.pair("AB2CD3", "edge");
    expect(data.get("deviceToken")).toBe("tok-2");
    expect(data.has("authState")).toBe(false);
    expect(data.has("queue")).toBe(false);
    await track(controller, "10:03:00", "https://khanacademy.org/");
    await controller.onAlarm(at("10:04:05"));
    const last = heartbeats(calls).pop();
    expect(last?.headers["Authorization"]).toBe("Bearer tok-2");
    expect(last?.body["entries"]).toContainEqual(expect.objectContaining({ domain: "khanacademy.org" }));
  });
});

const goodRules: Reply = { status: 200, body: { rulesVersion: 3, domains: ["a.com"], truncated: false } };
const blockedAttempt = { at: "2026-11-17T10:00:00.000Z", domain: "tiktok.com" };

describe("controller rules sync", () => {
  it("Newer version fetched and applied", async () => {
    const { post } = always(ok);
    const { get, calls } = createGet(() => goodRules);
    const { dnr, rules } = createDnr([7]);
    const { controller, data } = setup({ ...paired, rulesVersion: 2 }, post, { get, dnr });
    await controller.onAlarm(at("10:04:05"));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://fg.example/api/device/rules");
    expect(calls[0]?.headers).toEqual({ Authorization: "Bearer tok-1" });
    expect(rules()).toEqual(buildRules(["a.com"]));
    expect(data.get("rulesVersion")).toBe(3);
    expect(data.get("rulesDomains")).toEqual(["a.com"]);
  });

  it("Same version, no fetch", async () => {
    const { post } = always(ok);
    const { get, calls } = createGet(() => goodRules);
    const { dnr, updates } = createDnr();
    const { controller } = setup({ ...paired, rulesVersion: 3 }, post, { get, dnr });
    await controller.onAlarm(at("10:04:05"));
    expect(calls).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("First run without stored version", async () => {
    const { post } = always({ status: 200, body: { rulesVersion: 0 } });
    const { get, calls } = createGet(() => ({
      status: 200,
      body: { rulesVersion: 0, domains: [], truncated: false },
    }));
    const { controller } = setup(paired, post, { get, dnr: createDnr().dnr });
    await controller.onAlarm(at("10:04:05"));
    expect(calls).toHaveLength(1);
  });

  it("No fetch after a failed heartbeat or while rejected", async () => {
    const heartbeatReplies: Reply[] = [{ status: 500, body: { error: "server_error" } }, "network"];
    for (const reply of heartbeatReplies) {
      const { get, calls } = createGet(() => goodRules);
      const { controller } = setup(paired, always(reply).post, { get });
      await controller.onAlarm(at("10:04:05"));
      expect(calls).toHaveLength(0);
    }
    // rejected: 10:15 is a retry minute (615 min since midnight, 615 % 15 = 0), so a keep-alive is sent
    const rejectedRuns: Reply[] = [unauthorized, ok];
    for (const reply of rejectedRuns) {
      const { get, calls } = createGet(() => goodRules);
      const { controller } = setup({ ...paired, authState: "rejected" }, always(reply).post, { get });
      await controller.onAlarm(at("10:15:05"));
      expect(calls).toHaveLength(0);
    }
  });

  it("Retry on the next alarm", async () => {
    const { post } = always(ok);
    const { get, calls } = createGet((_call, index) => (index === 0 ? { status: 500 } : goodRules));
    const { dnr, rules } = createDnr();
    const { controller, data } = setup({ ...paired, rulesVersion: 2 }, post, { get, dnr });
    await controller.onAlarm(at("10:04:05"));
    expect(data.get("rulesVersion")).toBe(2);
    expect(rules()).toEqual([]);
    await controller.onAlarm(at("10:05:05"));
    expect(calls).toHaveLength(2);
    expect(rules()).toEqual(buildRules(["a.com"]));
    expect(data.get("rulesVersion")).toBe(3);
  });

  it("Offline alarm leaves rules alone", async () => {
    const { post } = always("network");
    const { get } = createGet(() => goodRules);
    const { dnr, updates } = createDnr([1]);
    const state = { ...paired, rulesVersion: 3, rulesDomains: ["a.com"] };
    const { controller, data } = setup(state, post, { get, dnr });
    await controller.onAlarm(at("10:04:05"));
    expect(updates).toHaveLength(0);
    expect(data.get("rulesVersion")).toBe(3);
    expect(data.get("rulesDomains")).toEqual(["a.com"]);
  });

  it("Rejection leaves rules alone", async () => {
    const { post } = always(unauthorized);
    const { get } = createGet(() => goodRules);
    const { dnr, updates } = createDnr([1]);
    const state = { ...paired, rulesVersion: 3, rulesDomains: ["a.com"] };
    const { controller, data } = setup(state, post, { get, dnr });
    await controller.onAlarm(at("10:04:05"));
    expect(data.get("authState")).toBe("rejected");
    expect(updates).toHaveLength(0);
    expect(data.get("rulesDomains")).toEqual(["a.com"]);
  });
});

describe("controller re-pairing resets rules", () => {
  const oldState = {
    deviceToken: "old",
    rulesVersion: 4,
    rulesDomains: ["a.example"],
    limitBlocked: { "roblox.com": "games" },
    rulesAllowedHours: { start: "07:00", end: "21:00" },
  };
  const pairOk: Reply = { status: 200, body: { deviceToken: "tok-2" } };
  const router = (heartbeat: Reply) =>
    createPost((call) => (call.url.endsWith("/api/device/pair") ? pairOk : heartbeat)).post;
  const rulesFor = (version: number, domains: string[]): Reply => ({
    status: 200,
    body: { rulesVersion: version, domains, truncated: false },
  });

  it("New child's rules apply after the first sync", async () => {
    const { dnr, rules } = createDnr([1, 2, 2000000]);
    const { get } = createGet(() => rulesFor(4, ["b.example"]));
    const { controller } = setup(oldState, router({ status: 200, body: { rulesVersion: 4 } }), { get, dnr });
    expect(await controller.pair("AB2CD3", "edge")).toEqual({ ok: true });
    expect(rules()).toEqual([]);
    await controller.onAlarm(at("10:04:05"));
    expect(rules()).toEqual(buildRules(["b.example"]));
  });

  it("Stale domains are not evaluated after re-pair", async () => {
    const { dnr, rules } = createDnr([1, 2000000]);
    const { get } = createGet(() => ({ status: 500 }));
    const { controller } = setup(oldState, router({ status: 200, body: { rulesVersion: 4 } }), { get, dnr });
    await controller.pair("AB2CD3", "edge");
    await controller.onAlarm(at("10:04:05"));
    expect(rules()).toEqual([]);
  });

  it("The previous child's other usage does not block the new child", async () => {
    const { dnr, rules } = createDnr();
    const { get } = createGet(() => ({ status: 500 }));
    const state = { ...oldState, otherUsage: { day: "2026-11-17", seconds: { games: 600 } } };
    const { controller, data } = setup(state, router({ status: 200, body: { rulesVersion: 4 } }), { get, dnr });
    expect(await controller.pair("AB2CD3", "edge")).toEqual({ ok: true });
    expect(data.has("otherUsage")).toBe(false);
    // the new child's limit, as an earlier sync would have stored it; local games usage is 0
    data.set("rulesLimits", [{ category: "games", minutesPerDay: 5 }]);
    data.set("rulesTimezone", "UTC");
    await controller.onAlarm(at("10:04:05"));
    expect(rules()).toEqual([]);
    expect(data.get("limitBlocked") ?? {}).toEqual({});
  });

  it("Store write fails after the rules were cleared", async () => {
    const fake = createStore(oldState);
    const store = {
      ...fake.store,
      set: async (key: string, value: unknown) => {
        if (key === "browser") throw new Error("set failed");
        return fake.store.set(key, value);
      },
    };
    const { dnr, rules } = createDnr([1]);
    const { get } = createGet(() => rulesFor(4, ["a.example"]));
    const controller = createController({
      store,
      post: router({ status: 200, body: { rulesVersion: 4 } }),
      get,
      dnr,
      baseUrl: "https://fg.example",
      extensionVersion: "0.2.0",
      os: "Windows",
      log: vi.fn(),
    });
    expect(await controller.pair("AB2CD3", "edge")).toEqual({ ok: false, reason: "failed" });
    expect(fake.data.get("deviceToken")).toBe("old");
    expect(rules()).toEqual([]);
    await controller.onAlarm(at("10:04:05"));
    expect(rules()).toEqual(buildRules(["a.example"]));
  });
});

describe("controller recordBlocked", () => {
  const now = at("10:05:30");

  it("Known domain recorded", async () => {
    const { controller, data } = setup({ ...paired, rulesDomains: ["tiktok.com"] }, always(ok).post);
    await controller.recordBlocked("tiktok.com", now);
    expect(data.get("blockedQueue")).toEqual([{ at: "2026-11-17T10:05:30.000Z", domain: "tiktok.com" }]);
  });

  it("Unknown domain ignored", async () => {
    const { controller, data } = setup(
      { ...paired, rulesDomains: ["tiktok.com"], blockedQueue: [blockedAttempt] },
      always(ok).post,
    );
    await controller.recordBlocked("evil.com", now);
    await controller.recordBlocked("https://tiktok.com/x", now);
    expect(data.get("blockedQueue")).toEqual([blockedAttempt]);
  });

  it("Unpaired device records nothing", async () => {
    const { controller, data } = setup({ rulesDomains: ["tiktok.com"] }, always(ok).post);
    await controller.recordBlocked("tiktok.com", now);
    expect(data.has("blockedQueue")).toBe(false);
    expect(data.size).toBe(1);
  });

  it("recorded attempt carries domain and time only", async () => {
    const { controller, data } = setup({ ...paired, rulesDomains: ["tiktok.com"] }, always(ok).post);
    await controller.recordBlocked("tiktok.com", now);
    const queue = data.get("blockedQueue") as Record<string, unknown>[];
    expect(Object.keys(queue[0] ?? {}).sort()).toEqual(["at", "domain"]);
  });
});

describe("controller serialization", () => {
  it("no overlapping runs", async () => {
    const gate = deferred<Reply>();
    const { post, calls } = createPost((_call, index) => (index === 0 ? gate.promise : ok));
    const { controller } = setup({ ...paired, queue: entries(1, 2) }, post);
    const first = controller.onAlarm(at("10:04:05"));
    const second = controller.onAlarm(at("10:05:05"));
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    await settle();
    expect(calls).toHaveLength(1);
    gate.resolve(ok);
    await Promise.all([first, second]);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.body["entries"]).toEqual(entries(1, 2));
    expect(calls[1]?.body["entries"]).toEqual([]);
  });

  it("Parsing (firefox heartbeat)", async () => {
    const { post, calls } = always(ok);
    const { controller } = setup({ ...paired, browser: "firefox" }, post);
    await controller.onAlarm(at("10:04:05"));
    expect(calls[0]?.body["browser"]).toBe("firefox");
  });

  it("stored browser is sent", async () => {
    const browsers: unknown[] = [];
    for (const stored of [{ browser: "brave" }, {}, { browser: "netscape" }]) {
      const { post, calls } = always(ok);
      const { controller } = setup({ ...paired, ...stored }, post);
      await controller.onAlarm(at("10:04:05"));
      browsers.push(calls[0]?.body["browser"]);
    }
    expect(browsers).toEqual(["brave", "other", "other"]);
  });

  it("pairing is serialized with a flush", async () => {
    const gate = deferred<Reply>();
    const { post, calls } = createPost((call) =>
      call.url.endsWith("/api/device/pair") ? { status: 200, body: { deviceToken: "tok-2" } } : gate.promise,
    );
    const { controller, data } = setup({ deviceToken: "old", queue: entries(1, 2) }, post);
    const alarm = controller.onAlarm(at("10:04:05"));
    const pairing = controller.pair("AB2CD3", "edge");
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    await settle();
    expect(calls).toHaveLength(1);
    gate.resolve(ok);
    await Promise.all([alarm, pairing]);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.url).toBe("https://fg.example/api/device/pair");
    expect(data.get("deviceToken")).toBe("tok-2");
    expect(data.has("queue")).toBe(false);
  });

  it("storage failure does not crash", async () => {
    const { post, calls } = always(ok);
    const fake = createStore(paired, { failGet: true });
    const log = vi.fn<(message: string) => void>();
    const controller = createController({
      store: fake.store,
      post,
      get: noRules().get,
      dnr: createDnr().dnr,
      baseUrl: "https://fg.example",
      extensionVersion: "0.2.0",
      os: "Windows",
      log,
    });
    await expect(
      controller.handleEvent({ type: "tab", at: at("10:03:00"), url: "https://www.youtube.com/" }),
    ).resolves.toBeUndefined();
    await expect(controller.onAlarm(at("10:04:05"))).resolves.toBeUndefined();
    expect(calls).toHaveLength(0);
    for (const [message] of log.mock.calls) {
      expect(message).not.toMatch(/youtube|tok-1|https?:/);
    }
  });
});

describe("controller limit enforcement", () => {
  const limitsGames = [{ category: "games", minutesPerDay: 5 }];
  const base = { ...paired, rulesVersion: 3, rulesDomains: [], rulesLimits: limitsGames, rulesTimezone: "UTC" };
  const paths = (rules: unknown[]) =>
    (rules as { action: { redirect: { extensionPath: string } } }[]).map((r) => r.action.redirect.extensionPath);

  // The tracker credits no time across a gap above 2 minutes, so alarms must run every minute like the real schedule.
  const alarms = async (controller: { onAlarm(now: number): Promise<void> }, from: number, to: number) => {
    for (let m = from; m <= to; m++) await controller.onAlarm(at(`10:${String(m).padStart(2, "0")}:05`));
  };

  it("Limit reached blocks the category", async () => {
    const { dnr, rules } = createDnr();
    const { controller, data } = setup(base, always(ok).post, { dnr });
    await track(controller, "10:00:00", "https://www.roblox.com/");
    // minutes 10:00..10:05 complete by 10:06:05 = 6 * 60 = 360 seconds >= 300
    await alarms(controller, 1, 6);
    const all = paths(rules());
    expect(all).toContain("/blocked.html?d=roblox.com&c=games");
    expect(all.some((p) => new URLSearchParams(p.split("?")[1]).get("d") === "youtube.com")).toBe(false);
    expect(data.get("limitBlocked")).toMatchObject({ "roblox.com": "games" });
  });

  it("Reset at midnight in the family timezone", async () => {
    const gamesBlocked = limitBlockDomains(["games"], {}, {}, []);
    const state = {
      ...base,
      rulesTimezone: "Asia/Ho_Chi_Minh",
      limitUsage: { day: "2026-11-17", seconds: { games: 600 }, domains: {} },
      limitBlocked: gamesBlocked,
    };
    const { dnr, updates, rules } = createDnr([5]);
    const { controller, data } = setup(state, always(ok).post, { dnr });
    await controller.onAlarm(at("16:59:30"));
    expect(updates).toHaveLength(0);
    expect(data.get("limitBlocked")).toEqual(gamesBlocked);
    await controller.onAlarm(at("17:00:30"));
    expect(rules()).toEqual([]);
    expect(data.get("limitBlocked")).toEqual({});
    expect(data.get("limitUsage")).toMatchObject({ day: "2026-11-18", seconds: {} });
  });

  it("Works offline", async () => {
    const { dnr, rules } = createDnr();
    const { controller } = setup(base, always("network").post, { dnr });
    await track(controller, "10:00:00", "https://roblox.com/");
    await alarms(controller, 1, 6);
    expect(paths(rules())).toContain("/blocked.html?d=roblox.com&c=games");
  });

  it("Survives a restart", async () => {
    const fake = createStore(base);
    const dnrBox = createDnr();
    const make = () =>
      createController({
        store: fake.store,
        post: always(ok).post,
        get: noRules().get,
        dnr: dnrBox.dnr,
        baseUrl: "https://fg.example",
        extensionVersion: "0.2.0",
        os: "Windows",
        log: () => undefined,
      });
    const first = make();
    await track(first, "10:00:00", "https://roblox.com/");
    // minutes 10:00..10:03 = 4 * 60 = 240 of 300 seconds
    await alarms(first, 1, 4);
    expect(dnrBox.rules()).toEqual([]);
    const second = make();
    // minutes 10:04 and 10:05 add 120 seconds: 360 >= 300
    await alarms(second, 5, 6);
    expect(paths(dnrBox.rules())).toContain("/blocked.html?d=roblox.com&c=games");
  });

  it("DNR failure retries", async () => {
    const inner = createDnr();
    let calls = 0;
    const dnr = {
      getDynamicRules: inner.dnr.getDynamicRules,
      async updateDynamicRules(options: Parameters<typeof inner.dnr.updateDynamicRules>[0]) {
        calls += 1;
        if (calls === 1) throw new Error("update failed");
        return inner.dnr.updateDynamicRules(options);
      },
    };
    const { controller, data } = setup(base, always(ok).post, { dnr });
    await track(controller, "10:00:00", "https://roblox.com/");
    // 300 seconds are complete at 10:05:05: the first DNR update fails there
    await alarms(controller, 1, 5);
    expect(data.has("limitBlocked")).toBe(false);
    await alarms(controller, 6, 6);
    expect(paths(inner.rules())).toContain("/blocked.html?d=roblox.com&c=games");
    expect(data.get("limitBlocked")).toMatchObject({ "roblox.com": "games" });
  });

  it("Limit-blocked domain recorded", async () => {
    const { controller, data } = setup(
      { ...paired, rulesDomains: [], limitBlocked: { "roblox.com": "games" } },
      always(ok).post,
    );
    await controller.recordBlocked("roblox.com", at("10:05:30"));
    expect(data.get("blockedQueue")).toEqual([{ at: "2026-11-17T10:05:30.000Z", domain: "roblox.com" }]);
  });
});

describe("controller allowed hours", () => {
  const hours = { start: "07:00", end: "21:00" };
  const hoursRule = (start: string) => ({
    id: 2000000,
    priority: 2,
    action: { type: "redirect", redirect: { extensionPath: `/blocked.html?h=${start}` } },
    condition: { regexFilter: "^https?://", resourceTypes: ["main_frame"] },
  });
  const base = { ...paired, rulesVersion: 3, rulesTimezone: "UTC", rulesAllowedHours: hours };
  const fakeAlarms = () => {
    const created: { name: string; when: number }[] = [];
    return {
      created,
      alarms: {
        create(name: string, info: { when: number }) {
          created.push({ name, when: info.when });
        },
      },
    };
  };
  const hasHours = (rules: { id: number }[]) => rules.some((r) => r.id === 2000000);
  const build = (
    initial: Record<string, unknown>,
    post: ReturnType<typeof createPost>["post"],
    dnr: ReturnType<typeof createDnr>["dnr"],
    alarms: ReturnType<typeof fakeAlarms>["alarms"],
  ) => {
    const fake = createStore(initial);
    const controller = createController({
      store: fake.store,
      post,
      get: noRules().get,
      dnr,
      alarms,
      baseUrl: "https://fg.example",
      extensionVersion: "0.2.0",
      os: "Windows",
      log: vi.fn(),
    });
    return { controller, data: fake.data };
  };

  it("Edges switch the rule on and off", async () => {
    const { dnr, updates, rules } = createDnr();
    const { created, alarms } = fakeAlarms();
    const { controller } = build(base, always(ok).post, dnr, alarms);
    await controller.onAlarm(Date.parse("2026-11-18T20:59:30Z"));
    expect(rules()).toEqual([]);
    await controller.onAlarm(Date.parse("2026-11-18T21:00:00Z"));
    expect(rules()).toEqual([hoursRule("07:00")]);
    const calls = updates.length;
    await controller.onAlarm(Date.parse("2026-11-18T21:00:30Z"));
    expect(updates).toHaveLength(calls);
    await controller.onAlarm(Date.parse("2026-11-19T07:00:00Z"));
    expect(rules()).toEqual([]);
    const whens = created.filter((c) => c.name === "hours-edge").map((c) => c.when);
    expect(whens[0]).toBe(Date.parse("2026-11-18T21:00:00Z"));
    expect(whens[1]).toBe(Date.parse("2026-11-19T07:00:00Z"));
  });

  it("Window crossing midnight", async () => {
    const { dnr, rules } = createDnr();
    const { alarms } = fakeAlarms();
    const { controller } = build(
      { ...base, rulesAllowedHours: { start: "07:00", end: "01:00" } },
      always(ok).post,
      dnr,
      alarms,
    );
    await controller.onAlarm(Date.parse("2026-11-18T23:30:00Z"));
    expect(hasHours(rules())).toBe(false);
    await controller.onAlarm(Date.parse("2026-11-19T01:00:00Z"));
    expect(hasHours(rules())).toBe(true);
    await controller.onAlarm(Date.parse("2026-11-19T07:00:00Z"));
    expect(hasHours(rules())).toBe(false);
  });

  it("Offline, rejected, restart and update failure", async () => {
    const now = Date.parse("2026-11-18T22:00:00Z");
    const next = Date.parse("2026-11-19T07:00:00Z");
    const runs: { extra: Record<string, unknown>; reply: Reply }[] = [
      { extra: {}, reply: "network" },
      { extra: { authState: "rejected" }, reply: unauthorized },
    ];
    for (const { extra, reply } of runs) {
      for (const preloaded of [[], [2000000]]) {
        const { dnr, rules } = createDnr(preloaded);
        const { created, alarms } = fakeAlarms();
        const { controller } = build({ ...base, ...extra }, createPost(() => reply).post, dnr, alarms);
        await controller.onAlarm(now);
        expect(hasHours(rules())).toBe(true);
        expect(created.filter((c) => c.name === "hours-edge").pop()?.when).toBe(next);
      }
    }

    const real = createDnr();
    let failed = false;
    const flaky = {
      getDynamicRules: () => real.dnr.getDynamicRules(),
      async updateDynamicRules(options: Parameters<typeof real.dnr.updateDynamicRules>[0]) {
        if (!failed) {
          failed = true;
          throw new Error("update failed");
        }
        return real.dnr.updateDynamicRules(options);
      },
    };
    const { alarms } = fakeAlarms();
    const { controller } = build(base, always(ok).post, flaky, alarms);
    await controller.onAlarm(now);
    expect(hasHours(real.rules())).toBe(false);
    await controller.onAlarm(now + 60_000);
    expect(hasHours(real.rules())).toBe(true);
  });

  it("Limit evaluation keeps the hours rule", async () => {
    const { dnr, rules, updates } = createDnr([2000000]);
    const { alarms } = fakeAlarms();
    const { controller } = build(
      {
        ...base,
        rulesDomains: [],
        rulesLimits: [{ category: "games", minutesPerDay: 5 }],
        limitUsage: { day: "2026-11-17", seconds: { games: 600 }, domains: {} },
      },
      always(ok).post,
      dnr,
      alarms,
    );
    await controller.onAlarm(Date.parse("2026-11-17T22:00:00Z"));
    expect(hasHours(rules())).toBe(true);
    expect(rules().length).toBeGreaterThan(1);
    // The rule must survive the limit update itself, not only be re-added by reconcileHours afterwards.
    expect(updates.length).toBeGreaterThan(0);
    expect(updates.every((u) => !u.removeRuleIds.includes(2000000))).toBe(true);
  });

  it("Successful re-pair", async () => {
    const { dnr, rules } = createDnr([2000000]);
    const { alarms } = fakeAlarms();
    const { controller, data } = build(
      base,
      always({ status: 200, body: { deviceToken: "tok-2" } }).post,
      dnr,
      alarms,
    );
    expect(await controller.pair("AB2CD3", "edge")).toEqual({ ok: true });
    expect(data.has("rulesAllowedHours")).toBe(false);
    await controller.onAlarm(Date.parse("2026-11-18T22:00:00Z"));
    expect(hasHours(rules())).toBe(false);
  });
});

describe("controller cross-browser usage", () => {
  const today = "2026-11-17";
  const limitsGames = [{ category: "games", minutesPerDay: 5 }];
  const base = { ...paired, rulesVersion: 3, rulesDomains: [], rulesLimits: limitsGames, rulesTimezone: "UTC" };
  const local = (seconds: number) => ({ day: today, seconds: { games: seconds }, domains: { "roblox.com": "games" } });
  const otherGames = (seconds: number, day = today) => ({ day, seconds: { games: seconds } });
  const heartbeat = (extra: Record<string, unknown> = {}): Reply => ({ status: 200, body: { rulesVersion: 3, ...extra } });
  const paths = (list: unknown[]) =>
    (list as { action: { redirect: { extensionPath: string } } }[]).map((r) => r.action.redirect.extensionPath);
  const gamesRule = "/blocked.html?d=roblox.com&c=games";

  it("Two browsers reach the limit together", async () => {
    // 120 local + 180 other = 300 >= 5 * 60 blocks; 120 + 179 = 299 does not
    for (const [other, blocked] of [[180, true], [179, false]] as const) {
      const { dnr, rules } = createDnr();
      const { controller } = setup(
        { ...base, limitUsage: local(120), otherUsage: otherGames(other) },
        always(heartbeat()).post,
        { dnr },
      );
      await controller.onAlarm(at("10:00:05"));
      expect(paths(rules()).includes(gamesRule), String(other)).toBe(blocked);
    }
  });

  it("Other browser's usage arrives with the heartbeat", async () => {
    const { dnr, rules } = createDnr();
    const { controller } = setup(
      { ...base, limitUsage: local(120) },
      always(heartbeat({ otherUsage: otherGames(180) })).post,
      { dnr },
    );
    await controller.onAlarm(at("10:00:05"));
    expect(paths(rules())).toContain(gamesRule);
  });

  it("Offline uses the last value", async () => {
    const { dnr, rules } = createDnr();
    const { controller } = setup({ ...base, otherUsage: otherGames(250) }, always("network").post, { dnr });
    await track(controller, "10:00:00", "https://roblox.com/");
    // the minute 10:00 completes at 10:01:05: 60 local + 250 other = 310 >= 300
    await controller.onAlarm(at("10:01:05"));
    expect(paths(rules())).toContain(gamesRule);
  });

  it("Day rollover ignores yesterday's value", async () => {
    const blocked = limitBlockDomains(["games"], {}, {}, []);
    const state = {
      ...base,
      rulesTimezone: "Asia/Ho_Chi_Minh",
      otherUsage: otherGames(300),
      limitBlocked: blocked,
    };
    const { dnr, rules, updates } = createDnr([5]);
    const { controller, data } = setup(state, always(heartbeat()).post, { dnr });
    await controller.onAlarm(at("16:59:30"));
    // still blocked by the other usage of 2026-11-17: nothing changes
    expect(updates).toHaveLength(0);
    expect(data.get("limitBlocked")).toEqual(blocked);
    // 17:00:30Z is 00:00:30 on 2026-11-18 in Ho Chi Minh, so the stored day is yesterday
    await controller.onAlarm(at("17:00:30"));
    expect(rules()).toEqual([]);
    expect(data.get("limitBlocked")).toEqual({});
  });

  it("Stored from heartbeat and rules, kept when absent", async () => {
    const { post } = createPost((_call, index) => (index === 0 ? heartbeat({ otherUsage: otherGames(120) }) : heartbeat()));
    const { dnr } = createDnr();
    const answer: Reply = {
      status: 200,
      body: { rulesVersion: 3, domains: [], truncated: false, otherUsage: otherGames(240) },
    };
    const { controller, data, store } = setup(base, post, { dnr });
    await controller.onAlarm(at("10:00:05"));
    expect(data.get("otherUsage")).toEqual(otherGames(120));
    await controller.onAlarm(at("10:01:05"));
    expect(data.get("otherUsage")).toEqual(otherGames(120));
    await syncRules({
      baseUrl: "https://fg.example",
      token: "tok-1",
      store,
      get: createGet(() => answer).get,
      dnr,
      now: at("10:02:05"),
    });
    expect(data.get("otherUsage")).toEqual(otherGames(240));
  });

  it("Invalid field in a heartbeat is ignored", async () => {
    const bad = { day: "x", seconds: { games: -5 } };
    const { post, calls } = createPost(() => heartbeat({ rulesVersion: 4, otherUsage: bad }));
    const { dnr, rules } = createDnr();
    const get = createGet(() => ({ status: 200, body: { rulesVersion: 4, domains: ["a.com"], truncated: false } })).get;
    const { controller, data } = setup({ ...base, queue: entries(1, 2), otherUsage: otherGames(120) }, post, { dnr, get });
    await controller.onAlarm(at("10:00:05"));
    expect(heartbeats(calls)).toHaveLength(1);
    expect(data.get("queue")).toEqual([]);
    expect(data.get("rulesVersion")).toBe(4);
    expect(rules()).toEqual(buildRules(["a.com"]));
    expect(data.get("otherUsage")).toEqual(otherGames(120));
  });
});

type Contains = (query: { origins: string[] }) => Promise<boolean>;

function setupPermissions(
  initial: Record<string, unknown>,
  contains: Contains | "missing",
  post: ReturnType<typeof createPost>["post"],
) {
  const fake = createStore(initial);
  const log = vi.fn<(message: string) => void>();
  const containsMock = vi.fn<Contains>(contains === "missing" ? async () => true : contains);
  const controller = createController({
    store: fake.store,
    post,
    get: noRules().get,
    dnr: createDnr().dnr,
    ...(contains === "missing" ? {} : { permissions: { contains: containsMock } }),
    baseUrl: "https://fg.example",
    extensionVersion: "0.2.0",
    os: "Windows",
    log,
  });
  return { ...fake, controller, log, contains: containsMock };
}

const ALL_URLS = { origins: ["<all_urls>"] };
const API_ORIGIN = { origins: ["https://fg.example/*"] };

/** Answers for the origin in the query, one per call; the last answer repeats, "reject" throws. */
function answers(map: Record<string, (boolean | "reject")[]>): Contains {
  const seen: Record<string, number> = {};
  return async ({ origins }) => {
    const key = origins[0] ?? "";
    const list = map[key] ?? [true];
    const i = seen[key] ?? 0;
    seen[key] = i + 1;
    const answer = list[Math.min(i, list.length - 1)];
    if (answer === "reject") throw new Error("permissions unavailable for secret-domain.example tok-1");
    return answer as boolean;
  };
}

describe("controller site access", () => {
  it("Value follows the browser", async () => {
    const order: string[] = [];
    const { post, calls } = createPost(() => {
      order.push("post");
      return ok;
    });
    const f = setupPermissions(paired, async () => true, post);
    const seq = answers({ "<all_urls>": [true, false, true] });
    f.contains.mockImplementation(async (q) => {
      if (q.origins[0] === "<all_urls>") order.push("contains");
      return seq(q);
    });
    for (const time of ["10:04:05", "10:05:05", "10:06:05"]) await f.controller.onAlarm(at(time));
    expect(f.contains).toHaveBeenCalledWith(ALL_URLS);
    expect(f.contains.mock.calls.filter(([q]) => q.origins[0] === "<all_urls>")).toHaveLength(3);
    expect(order).toEqual(["contains", "post", "contains", "post", "contains", "post"]);
    expect(heartbeats(calls).map((c) => c.body["siteAccess"])).toEqual([true, false, true]);
    for (const c of calls) {
      expect(Object.keys(c.body).sort()).toEqual(["browser", "currentDomain", "entries", "extensionVersion", "siteAccess"]);
      expect(() => HeartbeatRequest.parse(c.body)).not.toThrow();
    }

    // a rejected device's keep-alive carries the value too, with no entries
    const keepAlive = createPost(() => ok);
    const rejected = setupPermissions({ ...paired, authState: "rejected" }, answers({ "<all_urls>": [false] }), keepAlive.post);
    await rejected.controller.onAlarm(at("10:15:05"));
    expect(keepAlive.calls).toHaveLength(1);
    expect(keepAlive.calls[0]?.body["entries"]).toEqual([]);
    expect(keepAlive.calls[0]?.body["siteAccess"]).toBe(false);
    for (const key of [...f.data.keys(), ...rejected.data.keys()]) expect(key).not.toMatch(/site.?access/i);

    // a failing check and a missing dependency omit the field, never throw, and log no detail
    const failing = createPost(() => ok);
    const broken = setupPermissions(paired, answers({ "<all_urls>": ["reject"] }), failing.post);
    await broken.controller.onAlarm(at("10:04:05"));
    const missing = createPost(() => ok);
    const none = setupPermissions(paired, "missing", missing.post);
    await none.controller.onAlarm(at("10:04:05"));
    for (const c of [failing.calls, missing.calls]) {
      expect(c).toHaveLength(1);
      expect(c[0]?.body).not.toHaveProperty("siteAccess");
    }
    expect(broken.log).toHaveBeenCalled();
    for (const [message] of broken.log.mock.calls) {
      for (const secret of ["secret-domain", "tok-1", "https://", "youtube"]) expect(message).not.toContain(secret);
    }
  });

  it("API origin access kept locally, not sent", async () => {
    const { post, calls } = createPost(() => ok);
    const f = setupPermissions(paired, answers({ "https://fg.example/*": [false, "reject"] }), post);
    await f.controller.onAlarm(at("10:04:05"));
    expect(f.data.get("apiAccess")).toBe(false);
    await f.controller.onAlarm(at("10:05:05"));
    expect(f.contains).toHaveBeenCalledWith(API_ORIGIN);
    expect(f.data.get("apiAccess")).toBe(false);
    expect(heartbeats(calls)).toHaveLength(2);
    for (const c of calls) expect(c.raw).not.toContain("apiAccess");
  });
});
