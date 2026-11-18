import { describe, expect, it } from "vitest";
import { addBlocked, describeBlock, describeBlockDetail, parseBlockedMessage, parseBlockedQueue } from "./blocked";
import { NOW } from "./test-fakes";

describe("describeBlockDetail", () => {
  it("Limit page subtext says the limit is reached", () => {
    expect(describeBlockDetail("?d=roblox.com&c=games")).toContain("daily limit");
    expect(describeBlockDetail("?d=roblox.com&c=games")).not.toContain("Your parent has blocked");
    expect(describeBlockDetail("?d=roblox.com")).toContain("Your parent has blocked this site");
    expect(describeBlockDetail("?d=roblox.com&c=music")).toContain("Your parent has blocked this site");
  });
});

describe("describeBlock paused", () => {
  it("Paused text", () => {
    expect(describeBlock("?h=07:00")).toBe("Browsing is paused until 07:00");
    for (const q of ["?h=<script>", "?h=7:0", ""]) {
      expect(describeBlock(q)).toBe("This site is blocked");
    }
  });
});

describe("describeBlock", () => {
  it("Limit and generic text", () => {
    const limit = describeBlock("?d=roblox.com&c=games");
    expect(limit).toContain("Daily limit for games reached");
    const generic = describeBlock("?d=roblox.com");
    for (const text of [describeBlock("?d=roblox.com&c=music"), generic]) {
      expect(text).toContain("This site is blocked");
      expect(text).not.toContain("music");
      expect(text).not.toContain("Daily limit");
    }
    for (const text of [limit, generic]) expect(text).not.toMatch(/https?:|\//);
  });
});

// n seconds after 2026-11-17T00:00:00Z; n <= 1000 stays before NOW (10:05:30)
const attempt = (n: number) => ({
  at: new Date(Date.parse("2026-11-17T00:00:00Z") + n * 1000).toISOString(),
  domain: "tiktok.com",
});
const recent = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => attempt(from + i));
const fresh = { at: "2026-11-17T10:05:30.000Z", domain: "tiktok.com" };

describe("addBlocked", () => {
  it("Queue limits", () => {
    // oldest is 2026-11-10T10:00:00Z, older than NOW - 7 days = 2026-11-10T10:05:30Z
    const old = { at: "2026-11-10T10:00:00.000Z", domain: "old.com" };
    const queue = [old, ...recent(1, 999)];
    expect(queue).toHaveLength(1000);
    const result = addBlocked(queue, fresh, NOW);
    expect(result).not.toContainEqual(old);
    expect(result).toHaveLength(1000); // 1000 - 1 old + 1 new
    expect(result[result.length - 1]).toEqual(fresh);
  });

  it("Over the cap", () => {
    const queue = recent(1, 1000);
    const result = addBlocked(queue, fresh, NOW);
    expect(result).toHaveLength(1000);
    expect(result).not.toContainEqual(attempt(1));
    expect(result[0]).toEqual(attempt(2));
    expect(result[result.length - 1]).toEqual(fresh);
  });
});

describe("parseBlockedQueue", () => {
  it("Corrupt stored queue", () => {
    const valid = attempt(1);
    expect(parseBlockedQueue(undefined)).toEqual([]);
    expect(parseBlockedQueue("x")).toEqual([]);
    expect(parseBlockedQueue([null, { domain: "a.com" }, valid])).toEqual([valid]);
  });
});

describe("parseBlockedMessage", () => {
  it("Message parsing", () => {
    expect(
      parseBlockedMessage({ type: "blocked", domain: "tiktok.com", url: "https://tiktok.com/@x", title: "T" }),
    ).toEqual({ domain: "tiktok.com" });
    expect(parseBlockedMessage({ type: "pair", domain: "tiktok.com" })).toBeNull();
    expect(parseBlockedMessage({ type: "blocked", domain: 5 })).toBeNull();
    expect(parseBlockedMessage({ type: "blocked" })).toBeNull();
    expect(parseBlockedMessage("blocked")).toBeNull();
    expect(parseBlockedMessage(null)).toBeNull();
    expect(parseBlockedMessage(undefined)).toBeNull();
  });
});
