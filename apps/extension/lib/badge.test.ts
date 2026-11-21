import { describe, expect, it, vi } from "vitest";
import { resolveBadgeApi } from "./browser-info";
import { createController } from "./controller";
import { always, at, createDnr, createGet, createStore, type Reply } from "./test-fakes";

const ok: Reply = { status: 200, body: { rulesVersion: 3 } };
const COLOR = "#F59E0B";

function setup(initial: Record<string, unknown>, opts: { failText?: boolean } = {}) {
  const fake = createStore(initial);
  const { post, calls } = always(ok);
  const texts: string[] = [];
  const colors: string[] = [];
  const args: unknown[] = [];
  const badge = {
    setBadgeText: vi.fn(async (d: { text: string }) => {
      args.push(d);
      if (opts.failText) throw new Error("badge failed");
      texts.push(d.text);
    }),
    setBadgeBackgroundColor: vi.fn(async (d: { color: string }) => {
      args.push(d);
      colors.push(d.color);
    }),
  };
  const log = vi.fn<(message: string) => void>();
  const controller = createController({
    store: fake.store,
    post,
    get: createGet(() => "network").get,
    dnr: createDnr().dnr,
    badge,
    baseUrl: "https://fg.example",
    extensionVersion: "0.2.0",
    os: "Windows",
    log,
  });
  return { ...fake, controller, badge, texts, colors, args, calls, log };
}

const base = { deviceToken: "tok-1", rulesVersion: 3, rulesDomains: [], rulesTimezone: "UTC" };
const games = (minutes: number) => [{ category: "games", minutesPerDay: minutes }];
const usage = (seconds: number, day = "2026-11-17") => ({ day, seconds: { games: seconds }, domains: {} });
const tab = (time: string, url: string | null) => ({ type: "tab" as const, at: at(time), url });
const last = (texts: string[]) => texts[texts.length - 1];

describe("badge", () => {
  it("Tab with a limit near its end shows minutes", async () => {
    const t = setup({ ...base, rulesLimits: games(10), limitUsage: usage(480) });
    await t.controller.handleEvent(tab("10:00:00", "https://www.roblox.com/home"));
    // left = 600 - 480 = 120 s = 2 min
    expect(last(t.texts)).toBe("2");
    expect(last(t.colors)).toBe(COLOR);
  });

  it("Switching to a tab without a limit clears it", async () => {
    const t = setup({ ...base, rulesLimits: games(10), limitUsage: usage(480) });
    await t.controller.handleEvent(tab("10:00:00", "https://www.roblox.com/"));
    expect(last(t.texts)).toBe("2");
    await t.controller.handleEvent(tab("10:00:10", "https://www.wikipedia.org/"));
    expect(last(t.texts)).toBe("");
    await t.controller.handleEvent(tab("10:00:20", "https://www.roblox.com/"));
    await t.controller.handleEvent(tab("10:00:30", null));
    expect(last(t.texts)).toBe("");
  });

  it("More than five minutes left shows nothing", async () => {
    const t = setup({ ...base, rulesLimits: games(30), limitUsage: usage(600) });
    await t.controller.handleEvent(tab("10:00:00", "https://www.roblox.com/"));
    // left = 1800 - 600 = 1200 s > 300
    expect(last(t.texts)).toBe("");
  });

  it("Overrides decide the category", async () => {
    const t = setup({
      ...base,
      rulesLimits: games(10),
      rulesOverrides: { "youtube.com": "games" },
      limitUsage: usage(540),
    });
    await t.controller.handleEvent(tab("10:00:00", "https://www.youtube.com/watch"));
    // left = 600 - 540 = 60 s = 1 min
    expect(last(t.texts)).toBe("1");
  });

  it("Alarm counts down and ends empty", async () => {
    vi.useFakeTimers();
    try {
      const t = setup({ ...base, rulesLimits: games(5) });
      await t.controller.handleEvent({ type: "focus", at: at("10:00:00"), focused: true });
      await t.controller.handleEvent({ type: "idle", at: at("10:00:00"), state: "active" });
      await t.controller.handleEvent(tab("10:00:00", "https://www.roblox.com/"));
      const shown: string[] = [];
      for (const minute of ["10:01:05", "10:02:05", "10:03:05", "10:04:05", "10:05:05"]) {
        await t.controller.onAlarm(at(minute));
        shown.push(last(t.texts) ?? "?");
      }
      // used 60, 120, 180, 240, 300 s of 300: left 240, 180, 120, 60, 0 s -> 4, 3, 2, 1, null
      expect(shown).toEqual(["4", "3", "2", "1", ""]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("Usage of yesterday is ignored", async () => {
    const t = setup({
      ...base,
      rulesTimezone: "Asia/Ho_Chi_Minh",
      rulesLimits: games(10),
      limitUsage: usage(540, "2026-11-17"),
      trackerState: { lastAt: at("16:59:00"), domain: "roblox.com", focused: true, idle: "active", minutes: {} },
    });
    // 17:00:30Z is 00:00:30 on 2026-11-18 in Ho Chi Minh, so the stored day is stale
    await t.controller.onAlarm(Date.parse("2026-11-17T17:00:30Z"));
    expect(last(t.texts)).toBe("");
  });

  it("Rejected device clears the badge", async () => {
    const t = setup({ ...base, authState: "rejected", rulesLimits: games(10), limitUsage: usage(480) });
    await t.controller.onAlarm(at("10:00:30"));
    expect(t.texts).toEqual([""]);
  });

  it("No token, no badge call", async () => {
    const t = setup({ rulesLimits: games(10), limitUsage: usage(480) });
    await t.controller.handleEvent(tab("10:00:00", "https://www.roblox.com/"));
    await t.controller.onAlarm(at("10:01:05"));
    expect(t.badge.setBadgeText).not.toHaveBeenCalled();
    expect(t.badge.setBadgeBackgroundColor).not.toHaveBeenCalled();
  });

  it("Badge API rejects", async () => {
    const t = setup({ ...base, rulesLimits: games(10), limitUsage: usage(480) }, { failText: true });
    await t.controller.handleEvent(tab("10:00:00", "https://www.roblox.com/"));
    expect(t.data.get("trackerState")).toBeDefined();
    await t.controller.onAlarm(at("10:01:05"));
    expect(t.calls.filter((c) => c.url.endsWith("/api/device/heartbeat"))).toHaveLength(1);
    expect(t.log).toHaveBeenCalled();
  });

  it("Badge receives only text and color", async () => {
    const t = setup({ ...base, rulesLimits: games(10), limitUsage: usage(480) });
    await t.controller.handleEvent(tab("10:00:00", "https://www.roblox.com/path?q=secret"));
    expect(t.args.length).toBeGreaterThan(0);
    for (const a of t.args) expect(Object.keys(a as object)).toHaveLength(1);
    expect(t.args).toContainEqual({ text: "2" });
    expect(t.args).toContainEqual({ color: COLOR });
    const json = JSON.stringify(t.args);
    expect(json).not.toContain("path");
    expect(json).not.toContain("secret");
  });
});

describe("badge api resolution", () => {
  it("Badge API resolution (badge calls)", async () => {
    const browserAction = { setBadgeText: vi.fn(async (_d: { text: string }) => undefined) };
    await resolveBadgeApi({ browserAction })?.setBadgeText({ text: "!" });
    expect(browserAction.setBadgeText).toHaveBeenCalledWith({ text: "!" });

    const none = resolveBadgeApi<typeof browserAction>({});
    await expect(Promise.resolve().then(() => none?.setBadgeText({ text: "!" }))).resolves.toBeUndefined();
  });
});

describe("badge other usage", () => {
  const otherUsage = (day: string) => ({ day, seconds: { games: 240 } });

  it("Minutes left include the other browser", async () => {
    const t = setup({ ...base, rulesLimits: games(10), limitUsage: usage(240), otherUsage: otherUsage("2026-11-17") });
    await t.controller.handleEvent(tab("10:00:00", "https://www.roblox.com/home"));
    // left = 600 - (240 + 240) = 120 s = 2 min
    expect(last(t.texts)).toBe("2");
  });

  it("Stale other usage is ignored", async () => {
    const t = setup({ ...base, rulesLimits: games(10), limitUsage: usage(240), otherUsage: otherUsage("2026-11-16") });
    await t.controller.handleEvent(tab("10:00:00", "https://www.roblox.com/home"));
    // left = 600 - 240 = 360 s > 300, so nothing is shown
    expect(last(t.texts)).toBe("");
  });
});
