import { describe, expect, it } from "vitest";
import { addUsage, buildLimitRules, dayKey, limitBlockDomains, minutesLeft, overLimitCategories } from "./limits";
import { buildRules } from "./rules";

const ms = (iso: string) => Date.parse(iso);
const e = (domain: string, seconds: number, minute: string) => ({ minuteUtc: minute, domain, seconds });

describe("limits", () => {
  it("Seconds are summed by category with overrides and day", () => {
    const today = "2026-11-17T20:00:00.000Z";
    const now = ms("2026-11-18T03:00:00Z");
    const usage = addUsage(
      undefined,
      [
        e("roblox.com", 40, today),
        e("roblox.com", 20, today),
        e("youtube.com", 30, today),
        e("roblox.com", 50, "2026-11-17T16:59:00.000Z"),
      ],
      now,
      "Asia/Ho_Chi_Minh",
      { "youtube.com": "education" },
    );
    // games 40+20 = 60; education 30; the 16:59Z entry is 2026-11-17 in Ho Chi Minh (UTC+7), not today
    expect(usage.seconds).toEqual({ games: 60, education: 30 });
    expect(usage.day).toBe("2026-11-18");

    expect(dayKey(ms("2026-11-17T16:59:59Z"), "Asia/Ho_Chi_Minh")).toBe("2026-11-17");
    expect(dayKey(ms("2026-11-17T17:00:00Z"), "Asia/Ho_Chi_Minh")).toBe("2026-11-18");
    expect(dayKey(ms("2026-11-17T23:30:00Z"), "Not/AZone")).toBe("2026-11-17");
    expect(dayKey(ms("2026-11-17T23:30:00Z"), undefined)).toBe("2026-11-17");
    // New York is UTC-4 until 2026-11-01 06:00Z (DST ends), then UTC-5: local midnight Nov 2 is 05:00Z
    expect(dayKey(ms("2026-11-02T04:59:59Z"), "America/New_York")).toBe("2026-11-01");
    expect(dayKey(ms("2026-11-02T05:00:00Z"), "America/New_York")).toBe("2026-11-02");

    const stale = { day: "2026-11-17", seconds: { games: 500 }, domains: {} };
    expect(addUsage(stale, [], now, "Asia/Ho_Chi_Minh", {}).seconds).toEqual({});
  });

  it("Limit reached exactly", () => {
    const limits = [
      { category: "games" as const, minutesPerDay: 5 },
      { category: "news" as const, minutesPerDay: 10 },
    ];
    // games 5*60 = 300 reached; news 10*60 = 600 > 599
    expect(overLimitCategories(limits, { games: 300, news: 599, social: 9999 })).toEqual(["games"]);
    expect(overLimitCategories([], { games: 300 })).toEqual([]);
  });

  it("Recategorised site seen today is not blocked under its old category", () => {
    const set = limitBlockDomains(["games"], { "x.example.com": "education" }, { "x.example.com": "games" }, []);
    expect(set).not.toHaveProperty("x.example.com");
    const still = limitBlockDomains(["games"], {}, { "x.example.com": "games" }, []);
    expect(still).not.toHaveProperty("x.example.com");
  });

  it("Rounded up within five minutes", () => {
    const limits = [{ category: "games" as const, minutesPerDay: 10 }];
    // left = 600 - used: 300, 240, 60, 1 seconds -> ceil(/60) = 5, 4, 1, 1
    const results = [300, 360, 540, 599].map((used) => minutesLeft(limits, { games: used }, "games"));
    expect(results).toEqual([5, 4, 1, 1]);
  });

  it("Nothing outside the window", () => {
    const limits = [{ category: "games" as const, minutesPerDay: 10 }];
    // 299 used = 301 left (> 300); 600 and 700 are at or over the limit
    expect(minutesLeft(limits, { games: 299 }, "games")).toBeNull();
    expect(minutesLeft(limits, { games: 600 }, "games")).toBeNull();
    expect(minutesLeft(limits, { games: 700 }, "games")).toBeNull();
    expect(minutesLeft(limits, { news: 590 }, "news")).toBeNull();
    expect(minutesLeft(limits, { games: 540 }, null)).toBeNull();
  });

  it("Domain set and rules", () => {
    const set = limitBlockDomains(
      ["games"],
      { "youtube.com": "games", "chess.com": "education", "newgame.example.com": "games" },
      { "newgame.example.com": "games" },
      ["roblox.com"],
    );
    expect(Object.keys(set)).toEqual(expect.arrayContaining(["minecraft.net", "youtube.com", "newgame.example.com"]));
    expect(set).not.toHaveProperty("roblox.com");
    expect(set).not.toHaveProperty("chess.com");
    expect(set["minecraft.net"]).toBe("games");

    const firstId = buildRules(["roblox.com"]).length + 1;
    const rules = buildLimitRules(set, firstId);
    const mc = rules.find((r) => r.condition.requestDomains?.[0] === "minecraft.net");
    expect(mc?.action.redirect.extensionPath).toBe("/blocked.html?d=minecraft.net&c=games");
    expect(mc?.condition.resourceTypes).toEqual(["main_frame"]);
    expect(Math.min(...rules.map((r) => r.id))).toBe(2);

    // 4999 manual domains leave room for one limit rule (5000 total)
    const many = Array.from({ length: 4999 }, (_, i) => `m${i}.com`);
    const capped = limitBlockDomains(["games"], {}, {}, many);
    expect(Object.keys(capped).length).toBeLessThanOrEqual(1);
    expect(buildLimitRules(capped, 5000).length).toBeLessThanOrEqual(1);
  });
});
