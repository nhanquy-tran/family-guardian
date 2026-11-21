import { describe, expect, it } from "vitest";
import { formatLocalTime } from "./local-time";

describe("formatLocalTime", () => {
  it("formats in the given timezone, reading a missing or invalid one as UTC", () => {
    const iso = "2026-11-21T10:40:00.000Z";
    expect(formatLocalTime(iso, "Asia/Ho_Chi_Minh")).toBe("21 Nov, 17:40 GMT+7");
    expect(formatLocalTime(iso, "UTC")).toBe("21 Nov, 10:40 UTC");
    expect(formatLocalTime(iso, "Not/AZone")).toBe("21 Nov, 10:40 UTC");
    expect(formatLocalTime(iso, "")).toBe("21 Nov, 10:40 UTC");
  });

  it("moves the date across midnight", () => {
    expect(formatLocalTime("2026-11-21T20:30:00.000Z", "Asia/Ho_Chi_Minh")).toBe("22 Nov, 03:30 GMT+7");
  });
});
