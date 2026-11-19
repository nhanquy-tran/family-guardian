import { describe, expect, it, vi } from "vitest";
import { createController } from "./controller";
import { limitBlockDomains } from "./limits";
import { pairWithCode } from "./pairing";
import { syncRules } from "./rules";
import { flushQueue } from "./sender";
import {
  always,
  at,
  createDnr,
  createGet,
  createPost,
  createStore,
  entries,
  entry,
  NOW,
  sequence,
  type Reply,
} from "./test-fakes";

const TODAY = "2026-11-17";
const other = (games: number, day = TODAY) => ({ day, seconds: { games } });
const ok: Reply = { status: 200, body: { rulesVersion: 3 } };
const withOther = (value: unknown): Reply => ({ status: 200, body: { rulesVersion: 3, otherUsage: value } });
const limitsGames = [{ category: "games", minutesPerDay: 5 }];
const base = { deviceToken: "tok-1", rulesVersion: 3, rulesDomains: [], rulesLimits: limitsGames, rulesTimezone: "UTC" };
const noRules = () => createGet(() => "network");

function setup(
  initial: Record<string, unknown>,
  post: ReturnType<typeof createPost>["post"],
  rules: { get?: ReturnType<typeof createGet>["get"]; dnr?: ReturnType<typeof createDnr>["dnr"]; badge?: boolean } = {},
) {
  const fake = createStore(initial);
  const texts: string[] = [];
  const badge = {
    setBadgeText: vi.fn(async (d: { text: string }) => {
      texts.push(d.text);
    }),
    setBadgeBackgroundColor: vi.fn(async () => {}),
  };
  const controller = createController({
    store: fake.store,
    post,
    get: rules.get ?? noRules().get,
    dnr: rules.dnr ?? createDnr().dnr,
    ...(rules.badge ? { badge } : {}),
    baseUrl: "https://fg.example",
    extensionVersion: "0.2.0",
    os: "Windows",
    log: vi.fn(),
  });
  return { ...fake, controller, texts };
}

const paths = (rules: unknown[]) =>
  (rules as { action: { redirect: { extensionPath: string } } }[]).map((r) => r.action.redirect.extensionPath);
const robloxBlocked = (rules: unknown[]) => paths(rules).includes("/blocked.html?d=roblox.com&c=games");

async function track(controller: ReturnType<typeof setup>["controller"], time: string, url: string | null) {
  await controller.handleEvent({ type: "focus", at: at(time), focused: true });
  await controller.handleEvent({ type: "idle", at: at(time), state: "active" });
  await controller.handleEvent({ type: "tab", at: at(time), url });
}

// The tracker credits no time across a gap above 2 minutes, so alarms run every minute.
async function alarms(controller: ReturnType<typeof setup>["controller"], from: number, to: number) {
  for (let m = from; m <= to; m++) await controller.onAlarm(at(`10:${String(m).padStart(2, "0")}:05`));
}

describe("sender other usage", () => {
  it("Several chunks use the last 200 response", async () => {
    const replies: Reply[] = [{ status: 413, body: { error: "too_many_entries" } }, withOther(other(60)), withOther(other(120)), withOther(other(180))];
    const { post, calls } = sequence(replies, ok);
    const fake = createStore({ queue: entries(1, 3) });
    const result = await flushQueue({
      now: NOW,
      token: "tok-1",
      baseUrl: "https://fg.example",
      browser: "edge",
      extensionVersion: "0.2.0",
      currentDomain: null,
      keepAliveOnly: false,
      store: fake.store,
      post,
    });
    // 413 on three entries halves to chunks of one: three 200 chunk requests follow
    expect(calls).toHaveLength(4);
    expect(result).toEqual({ kind: "ok", rulesVersion: 3, otherUsage: other(180) });
    expect(entry(1).domain).toBe("example.com");
  });
});

describe("controller other usage", () => {
  it("Stored from heartbeat and rules, kept when absent", async () => {
    const { post } = sequence([withOther(other(120)), ok], ok);
    const t = setup(base, post);
    await t.controller.onAlarm(at("10:01:05"));
    expect(t.data.get("otherUsage")).toEqual(other(120));
    await t.controller.onAlarm(at("10:02:05"));
    expect(t.data.get("otherUsage")).toEqual(other(120));

    const get = createGet(() => ({
      status: 200,
      body: { rulesVersion: 3, domains: [], truncated: false, timezone: "UTC", otherUsage: other(240) },
    })).get;
    await syncRules({ baseUrl: "https://fg.example", token: "tok-1", store: t.store, get, dnr: createDnr().dnr, now: at("10:03:05") });
    expect(t.data.get("otherUsage")).toEqual(other(240));
  });

  it("Invalid field in a heartbeat is ignored", async () => {
    const rulesReply = createGet(() => ({ status: 200, body: { rulesVersion: 4, domains: [], truncated: false } }));
    const post = always({
      status: 200,
      body: { rulesVersion: 4, otherUsage: { day: "x", seconds: { games: -5 } } },
    }).post;
    const t = setup({ ...base, otherUsage: other(120), queue: entries(1, 2) }, post, { get: rulesReply.get });
    await t.controller.onAlarm(at("10:01:05"));
    expect(t.data.get("queue")).toEqual([]);
    expect(rulesReply.calls).toHaveLength(1);
    expect(t.data.get("rulesVersion")).toBe(4);
    expect(t.data.get("otherUsage")).toEqual(other(120));
  });

  it("Two browsers reach the limit together", async () => {
    for (const [seconds, blocked] of [[180, true], [179, false]] as const) {
      const { dnr, rules } = createDnr();
      const t = setup({ ...base, otherUsage: other(seconds) }, always(ok).post, { dnr });
      await track(t.controller, "10:00:00", "https://www.roblox.com/");
      // two completed minutes = 120 s local; 120 + 180 = 300 reaches 5 min, 120 + 179 does not
      await alarms(t.controller, 1, 2);
      expect(robloxBlocked(rules()), String(seconds)).toBe(blocked);
    }
  });

  it("Other browser's usage arrives with the heartbeat", async () => {
    const { dnr, rules } = createDnr();
    const t = setup(base, sequence([ok], withOther(other(180))).post, { dnr });
    await track(t.controller, "10:00:00", "https://www.roblox.com/");
    await alarms(t.controller, 1, 1);
    expect(robloxBlocked(rules())).toBe(false);
    await alarms(t.controller, 2, 2);
    expect(robloxBlocked(rules())).toBe(true);
  });

  it("Offline uses the last value", async () => {
    const { dnr, rules } = createDnr();
    const t = setup({ ...base, otherUsage: other(250) }, always("network").post, { dnr });
    await track(t.controller, "10:00:00", "https://roblox.com/");
    // 60 local + 250 stored = 310 >= 300
    await alarms(t.controller, 1, 2);
    expect(robloxBlocked(rules())).toBe(true);
  });

  it("Day rollover ignores yesterday's value", async () => {
    const blocked = limitBlockDomains(["games"], {}, {}, []);
    const state = { ...base, rulesTimezone: "Asia/Ho_Chi_Minh", otherUsage: other(300), limitBlocked: blocked };
    const { dnr, rules } = createDnr([5]);
    const t = setup(state, always(ok).post, { dnr });
    await t.controller.onAlarm(at("16:59:30"));
    expect(t.data.get("limitBlocked")).toEqual(blocked);
    await t.controller.onAlarm(at("17:00:30"));
    expect(rules()).toEqual([]);
    expect(t.data.get("limitBlocked")).toEqual({});
  });
});

describe("rules sync other usage", () => {
  const rulesBody = (extra: Record<string, unknown>) => ({
    status: 200,
    body: { rulesVersion: 5, domains: [], truncated: false, limits: limitsGames, timezone: "UTC", ...extra },
  });
  const usage = { day: TODAY, seconds: { games: 120 }, domains: {} };

  it("A sync applies it", async () => {
    const fake = createStore({ rulesVersion: 2, rulesDomains: [], limitUsage: usage });
    const { dnr, updates } = createDnr();
    const get = createGet(() => rulesBody({ otherUsage: other(180) })).get;
    await syncRules({ baseUrl: "https://fg.example", token: "tok-1", store: fake.store, get, dnr, now: at("10:05:30") });
    // 120 local + 180 other = 300 >= 5 * 60
    expect(robloxBlocked(updates[0]?.addRules ?? [])).toBe(true);
    expect(fake.data.get("limitBlocked")).toMatchObject({ "roblox.com": "games" });
  });

  it("Invalid field in a rules sync is ignored", async () => {
    const fake = createStore({ rulesVersion: 2, rulesDomains: [], limitUsage: usage, otherUsage: other(120) });
    const get = createGet(() => rulesBody({ otherUsage: { day: TODAY, seconds: { games: 1.5 } } })).get;
    const result = await syncRules({ baseUrl: "https://fg.example", token: "tok-1", store: fake.store, get, dnr: createDnr().dnr, now: at("10:05:30") });
    expect(result).toEqual({ kind: "ok", rulesVersion: 5 });
    expect(fake.data.get("rulesLimits")).toEqual(limitsGames);
    expect(fake.data.get("rulesVersion")).toBe(5);
    expect(fake.data.get("otherUsage")).toEqual(other(120));
  });
});

describe("badge other usage", () => {
  const state = { ...base, rulesLimits: [{ category: "games", minutesPerDay: 10 }], limitUsage: { day: TODAY, seconds: { games: 240 }, domains: {} } };
  const tab = { type: "tab" as const, at: at("10:00:00"), url: "https://www.roblox.com/home" };

  it("Minutes left include the other browser", async () => {
    const t = setup({ ...state, otherUsage: other(240) }, always(ok).post, { badge: true });
    await t.controller.handleEvent(tab);
    // left = 600 - (240 + 240) = 120 s = 2 min
    expect(t.texts[t.texts.length - 1]).toBe("2");
  });

  it("Stale other usage is ignored", async () => {
    const t = setup({ ...state, otherUsage: other(240, "2026-11-16") }, always(ok).post, { badge: true });
    await t.controller.handleEvent(tab);
    // left = 600 - 240 = 360 s, above five minutes
    expect(t.texts[t.texts.length - 1]).toBe("");
  });
});

describe("re-pair other usage", () => {
  it("Successful re-pair", async () => {
    const { store, data } = createStore({ deviceToken: "old", otherUsage: other(300), limitUsage: { day: TODAY, seconds: {}, domains: {} } });
    const { post } = always({ status: 200, body: { deviceToken: "tok-2" } });
    const result = await pairWithCode({ baseUrl: "https://fg.example", browser: "edge", os: "Windows", store, post }, "AB2CD3");
    expect(result).toEqual({ ok: true });
    expect(data.has("otherUsage")).toBe(false);
    expect(data.get("deviceToken")).toBe("tok-2");
  });

  it("The previous child's other usage does not block the new child", async () => {
    const { dnr, rules } = createDnr();
    const t = setup({ ...base, otherUsage: other(300) }, always({ status: 200, body: { deviceToken: "tok-2" } }).post, { dnr });
    expect(await t.controller.pair("AB2CD3", "edge")).toEqual({ ok: true });
    // the new child's limit is synced later; the fetch fails, so the stored limit comes back only from a sync
    await t.store.set("rulesLimits", limitsGames);
    await t.store.set("rulesTimezone", "UTC");
    await t.controller.onAlarm(at("10:01:05"));
    expect(robloxBlocked(rules())).toBe(false);
    expect(t.data.get("limitBlocked") ?? {}).toEqual({});
  });
});
