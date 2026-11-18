import { describe, expect, it } from "vitest";
import {
  HeartbeatEnvelope,
  HeartbeatRequest,
  MAX_BLOCKED_ATTEMPTS,
  MAX_HEARTBEAT_ENTRIES,
  MAX_RULE_DOMAINS,
  RulesResponse,
  UsageEntry,
} from "./contracts";

const entry = { minuteUtc: "2026-11-17T10:03:00Z", domain: "youtube.com", seconds: 40 };
const base = { currentDomain: null, browser: "edge", extensionVersion: "0.2.0" };

describe("heartbeat contracts", () => {
  it("Envelope schema in shared package", () => {
    const body = { ...base, entries: [{ ...entry, seconds: 61 }] };
    expect(HeartbeatEnvelope.safeParse(body).success).toBe(true);
    expect(HeartbeatRequest.safeParse(body).success).toBe(false);
    expect(UsageEntry.safeParse({ ...entry, seconds: 61 }).success).toBe(false);
    expect(UsageEntry.safeParse(entry).success).toBe(true);
  });

  it("Constant exported", () => {
    expect(MAX_HEARTBEAT_ENTRIES).toBe(1440);
    const many = (n: number) => ({ ...base, entries: Array.from({ length: n }, () => entry) });
    expect(HeartbeatRequest.safeParse(many(1441)).success).toBe(false);
    expect(HeartbeatRequest.safeParse(many(1440)).success).toBe(true);
  });

  it("Envelope rejects a bad browser, long version, non-array entries and missing currentDomain", () => {
    const { currentDomain: _c, ...noCurrent } = { ...base, entries: [] };
    for (const bad of [
      { ...base, entries: [], browser: "firefox" },
      { ...base, entries: [], extensionVersion: "x".repeat(33) },
      { ...base, entries: "nope" },
      noCurrent,
    ]) {
      expect(HeartbeatEnvelope.safeParse(bad).success).toBe(false);
    }
  });
});

describe("blocked attempts in the heartbeat contract", () => {
  const attempt = { at: "2026-11-17T10:00:00Z", domain: "tiktok.com" };
  const many = (n: number) => ({ ...base, entries: [], blocked: Array.from({ length: n }, () => attempt) });

  it("Contract accepts with and without blocked", () => {
    const without = { ...base, entries: [entry] };
    const withBlocked = { ...base, entries: [entry], blocked: [attempt] };
    for (const schema of [HeartbeatRequest, HeartbeatEnvelope]) {
      expect(schema.safeParse(without).success).toBe(true);
      expect(schema.safeParse(withBlocked).success).toBe(true);
    }
    const stripped = HeartbeatRequest.parse({ ...base, entries: [], blocked: [{ ...attempt, url: "https://tiktok.com/@x" }] });
    expect((stripped as { blocked?: unknown }).blocked).toEqual([attempt]);
    expect(HeartbeatRequest.safeParse(many(1001)).success).toBe(false);
    expect(HeartbeatRequest.safeParse(many(1000)).success).toBe(true);
    expect(MAX_BLOCKED_ATTEMPTS).toBe(1000);
  });
});

describe("rules response contract", () => {
  it("Contract limits", () => {
    const domains = (n: number) => Array.from({ length: n }, (_, i) => `site${i}.com`);
    expect(RulesResponse.safeParse({ rulesVersion: 1, domains: domains(5001), truncated: true }).success).toBe(false);
    expect(RulesResponse.safeParse({ rulesVersion: 1, domains: domains(5000), truncated: false }).success).toBe(true);
    expect(MAX_RULE_DOMAINS).toBe(5000);
  });
});

describe("RulesResponse limits and timezone", () => {
  const base = { rulesVersion: 1, domains: [], truncated: false };
  const games = { category: "games", minutesPerDay: 60 };

  it("New fields parse and are bounded", () => {
    const ok = { ...base, limits: [games], timezone: "Asia/Ho_Chi_Minh" };
    expect(RulesResponse.parse(ok)).toEqual({ ...ok, categoryOverrides: {} });
    const bad: Record<string, unknown>[] = [
      { limits: [{ category: "music", minutesPerDay: 60 }] },
      { limits: [{ category: "games", minutesPerDay: 4 }] },
      { limits: [{ category: "games", minutesPerDay: 1441 }] },
      { limits: [{ category: "games", minutesPerDay: 1.5 }] },
      { timezone: "" },
      { timezone: "x".repeat(65) },
      { limits: Array.from({ length: 10 }, () => games) },
    ];
    for (const extra of bad) expect(RulesResponse.safeParse({ ...base, ...extra }).success, JSON.stringify(extra)).toBe(false);
  });

  it("Duplicate categories rejected", () => {
    expect(RulesResponse.safeParse({ ...base, limits: [games, games] }).success).toBe(false);
  });

  it("Older body still parses", () => {
    const parsed = RulesResponse.parse(base) as unknown as { limits?: unknown; timezone?: unknown };
    expect(parsed.limits).toEqual([]);
    expect(parsed.timezone).toBeUndefined();
    expect((parsed as { categoryOverrides?: unknown }).categoryOverrides).toEqual({});
  });

  it("Category overrides are bounded", () => {
    const ok = { ...base, categoryOverrides: { "youtube.com": "education" } };
    expect(RulesResponse.parse(ok)).toEqual({ ...ok, limits: [] });
    const many = Object.fromEntries(Array.from({ length: 5001 }, (_, i) => [`d${i}.com`, "games"]));
    const bad: Record<string, unknown>[] = [
      { categoryOverrides: { "youtube.com": "music" } },
      { categoryOverrides: { [`${"a".repeat(250)}.com`]: "games" } },
      { categoryOverrides: many },
    ];
    for (const extra of bad) expect(RulesResponse.safeParse({ ...base, ...extra }).success).toBe(false);
  });
});
