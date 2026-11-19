import { RulesResponse } from "@fg/shared";
import { describe, expect, it, vi } from "vitest";
import { handleRules, type RulesStore } from "./rules-endpoint";
import { hashDeviceToken } from "./token";

const GOOD = { day: "2026-11-17", seconds: { games: 600 } };

function fakeStore(other: () => Promise<unknown>) {
  const otherUsage = vi.fn(async (_deviceId: string) => other());
  const store: RulesStore = {
    findChild: async (hash) =>
      hash === hashDeviceToken("tok-1")
        ? {
            deviceId: "dev-1",
            childId: "child-1",
            familyId: "fam-1",
            rulesVersion: 3,
            timezone: "Asia/Ho_Chi_Minh",
            allowedHours: null,
          }
        : null,
    listLimits: async () => [],
    listRules: async () => [{ kind: "domain", value: "youtube.com" }],
    listCategoryOverrides: async () => [],
    otherUsage,
  };
  return { store, otherUsage };
}

const call = (store: RulesStore) => handleRules({ authorization: "Bearer tok-1", store });

describe("rules other usage", () => {
  it("Rules include other usage", async () => {
    const f = fakeStore(async () => GOOD);
    const res = await call(f.store);
    expect(res.status).toBe(200);
    expect(RulesResponse.safeParse(res.body).success).toBe(true);
    expect((res.body as { otherUsage?: unknown }).otherUsage).toEqual(GOOD);
    expect(f.otherUsage).toHaveBeenCalledWith("dev-1");
  });

  it("Other usage fails", async () => {
    const f = fakeStore(async () => {
      throw new Error("db down");
    });
    const res = await call(f.store);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("otherUsage");
  });

  it("Invalid value does not cause a 500", async () => {
    const f = fakeStore(async () => ({ day: "x", seconds: { games: -1 } }));
    const res = await call(f.store);
    expect(res.status).toBe(200);
    expect((res.body as { domains: string[] }).domains).toContain("youtube.com");
    expect(res.body).not.toHaveProperty("otherUsage");
  });
});
