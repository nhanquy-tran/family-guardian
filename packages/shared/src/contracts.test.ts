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
