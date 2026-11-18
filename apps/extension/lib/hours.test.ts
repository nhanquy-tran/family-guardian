import { describe, expect, it } from "vitest";
import { buildHoursRule, inAllowedHours, nextEdge } from "./hours";

const t = (iso: string) => Date.parse(iso);
const day = { start: "07:00", end: "21:00" };
const night = { start: "22:00", end: "06:00" };

describe("inAllowedHours", () => {
  it("Inside and outside, both window shapes", () => {
    const hcm = "Asia/Ho_Chi_Minh"; // UTC+7
    // 23:59Z = 06:59 local, 00:00Z = 07:00, 13:59Z = 20:59, 14:00Z = 21:00
    const results = ["2026-11-17T23:59:00Z", "2026-11-18T00:00:00Z", "2026-11-18T13:59:00Z", "2026-11-18T14:00:00Z"].map(
      (iso) => inAllowedHours(day, t(iso), hcm),
    );
    expect(results).toEqual([false, true, true, false]);
    // local 21:59 = 14:59Z, 22:00 = 15:00Z, 23:59 = 16:59Z, 00:00 = 17:00Z, 05:59 = 22:59Z, 06:00 = 23:00Z
    const crossing = [
      "2026-11-17T14:59:00Z",
      "2026-11-17T15:00:00Z",
      "2026-11-17T16:59:00Z",
      "2026-11-17T17:00:00Z",
      "2026-11-17T22:59:00Z",
      "2026-11-17T23:00:00Z",
    ].map((iso) => inAllowedHours(night, t(iso), hcm));
    expect(crossing).toEqual([false, true, true, true, true, false]);
    expect(inAllowedHours(null, t("2026-11-18T03:00:00Z"), "UTC")).toBe(true);
    expect(inAllowedHours({ start: "7:00", end: "x" }, t("2026-11-18T03:00:00Z"), "UTC")).toBe(true);
    // Not/AZone is read as UTC: 06:59Z is outside 07:00-21:00, 07:00Z is inside
    expect(inAllowedHours(day, t("2026-11-18T06:59:00Z"), "Not/AZone")).toBe(false);
    expect(inAllowedHours(day, t("2026-11-18T07:00:00Z"), "Not/AZone")).toBe(true);
    expect(inAllowedHours(day, t("2026-11-18T07:00:00Z"), undefined)).toBe(true);
  });
});

describe("nextEdge", () => {
  it("Next edge", () => {
    expect(nextEdge(day, t("2026-11-18T06:30:20Z"), "UTC")).toBe(t("2026-11-18T07:00:00Z"));
    expect(nextEdge(day, t("2026-11-18T10:00:00Z"), "UTC")).toBe(t("2026-11-18T21:00:00Z"));
    expect(nextEdge(day, t("2026-11-18T21:30:00Z"), "UTC")).toBe(t("2026-11-19T07:00:00Z"));
    expect(nextEdge(null, t("2026-11-18T10:00:00Z"), "UTC")).toBeNull();
    // DST ended 2026-11-01 06:00Z; 11:30Z = 06:30 EST, 07:00 EST = 12:00Z
    expect(nextEdge(day, t("2026-11-01T11:30:00Z"), "America/New_York")).toBe(t("2026-11-01T12:00:00Z"));
  });
});

describe("buildHoursRule", () => {
  it("Rule shape", () => {
    expect(buildHoursRule("07:00")).toEqual({
      id: 2000000,
      priority: 2,
      action: { type: "redirect", redirect: { extensionPath: "/blocked.html?h=07:00" } },
      condition: { regexFilter: "^https?://", resourceTypes: ["main_frame"] },
    });
  });
});
