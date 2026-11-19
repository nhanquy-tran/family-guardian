import { describe, expect, it } from "vitest";
import { HeartbeatResponse, OtherUsage, RulesResponse } from "./contracts";

describe("other usage contract", () => {
  it("Contract", () => {
    expect(OtherUsage.safeParse({ day: "2026-11-17", seconds: { games: 60 } }).success).toBe(true);
    for (const bad of [
      { day: "x", seconds: {} },
      { day: "2026-11-17", seconds: { music: 60 } },
      { day: "2026-11-17", seconds: { games: -1 } },
      { day: "2026-11-17", seconds: { games: 1.5 } },
      { day: "2026-11-17", seconds: { "roblox.com": 60 } },
    ]) {
      expect(OtherUsage.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
    const invalid = { day: "x", seconds: { games: -1 } };
    for (const extra of [{}, { otherUsage: invalid }]) {
      expect(HeartbeatResponse.safeParse({ rulesVersion: 3, ...extra }).success).toBe(true);
      expect(RulesResponse.safeParse({ rulesVersion: 3, domains: [], truncated: false, ...extra }).success).toBe(true);
    }
  });
});
