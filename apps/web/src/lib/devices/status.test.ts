import { describe, expect, it } from "vitest";
import { deviceLabel, deviceStatus, formatLastSeen } from "./status";

const now = new Date("2026-11-17T10:00:00Z");

describe("deviceStatus", () => {
  it("seen recently is online", () => {
    expect(deviceStatus("2026-11-17T09:59:00Z", now)).toBe("online");
    expect(deviceStatus("2026-11-17T09:57:00.001Z", now)).toBe("online");
  });

  it("seen 3 minutes ago or more is offline", () => {
    expect(deviceStatus("2026-11-17T09:57:00Z", now)).toBe("offline");
    expect(deviceStatus("2026-11-16T10:00:00Z", now)).toBe("offline");
  });

  it("never seen is offline", () => {
    expect(deviceStatus(null, now)).toBe("offline");
  });

  it("clock skew counts as online", () => {
    expect(deviceStatus("2026-11-17T10:00:30Z", now)).toBe("online");
  });
});

describe("formatLastSeen", () => {
  it("formatting buckets", () => {
    const inputs = [
      null,
      "2026-11-17T09:59:30Z",
      "2026-11-17T10:00:30Z",
      "2026-11-17T09:58:00Z",
      "2026-11-17T09:01:00Z",
      "2026-11-17T07:30:00Z",
      "2026-11-14T09:00:00Z",
    ];
    expect(inputs.map((i) => formatLastSeen(i, now))).toEqual([
      "Never",
      "just now",
      "just now",
      "2 min ago",
      "59 min ago",
      "2 h ago",
      "3 d ago",
    ]);
  });
});

describe("deviceLabel", () => {
  it("blank name falls back to default", () => {
    expect(deviceLabel({ name: "   ", browser: "brave", os: "Windows" })).toBe("Brave on Windows");
  });

  it("name or default", () => {
    expect(deviceLabel({ name: "Lan's laptop", browser: "chrome", os: "Windows" })).toBe("Lan's laptop");
    expect(deviceLabel({ name: null, browser: "edge", os: "Windows" })).toBe("Edge on Windows");
    expect(deviceLabel({ name: null, browser: "firefox", os: "Windows" })).toBe("Firefox on Windows");
    expect(deviceLabel({ name: null, browser: "other", os: "Windows" })).toBe("Other browser on Windows");
  });
});
