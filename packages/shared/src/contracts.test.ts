import { describe, expect, it } from "vitest";
import { HeartbeatEnvelope, HeartbeatRequest, MAX_HEARTBEAT_ENTRIES, UsageEntry } from "./contracts";

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
