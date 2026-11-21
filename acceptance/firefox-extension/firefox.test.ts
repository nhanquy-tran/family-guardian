import { HeartbeatEnvelope, HeartbeatRequest, PairRequest } from "@fg/shared";
import { describe, expect, it } from "vitest";
import { detectBrowser, parseBrowserName, resolveBadgeApi } from "../../apps/extension/lib/browser-info";
import { buildFirefoxManifest, buildManifest, FIREFOX_MANIFEST_VERSION } from "../../apps/extension/lib/manifest";
import { applyEvent, createTracker, takeCompletedEntries, type TrackerEvent } from "../../apps/extension/lib/tracker";
import { browserLabel } from "../../apps/web/src/lib/devices/status";

const rec = (value: unknown) => value as Record<string, unknown>;

describe("acceptance: firefox browser value end to end", () => {
  it("acceptance: every contract accepts firefox and still rejects unknown browsers", () => {
    const body = { entries: [], currentDomain: "example.org", extensionVersion: "9.9.9" };
    for (const browser of ["chrome", "edge", "brave", "firefox", "other"]) {
      expect(HeartbeatEnvelope.safeParse({ ...body, browser }).success, browser).toBe(true);
      expect(HeartbeatRequest.safeParse({ ...body, browser }).success, browser).toBe(true);
      expect(PairRequest.safeParse({ code: "ZZ9ZZ9", browser, os: "Windows" }).success, browser).toBe(true);
    }
    for (const browser of ["Firefox", "gecko", ""]) {
      expect(PairRequest.safeParse({ code: "ZZ9ZZ9", browser, os: "Windows" }).success, browser).toBe(false);
    }
  });

  it("acceptance: Firefox user agents are detected only when no Chromium marker is present", () => {
    const ff = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0";
    expect(detectBrowser({ brands: [], userAgent: ff, isBrave: false })).toBe("firefox");
    expect(detectBrowser({ brands: ["Google Chrome"], userAgent: ff, isBrave: false })).toBe("chrome");
    expect(detectBrowser({ brands: [], userAgent: `${ff} Edg/1.0`, isBrave: false })).toBe("edge");
    expect(parseBrowserName("firefox")).toBe("firefox");
    expect(parseBrowserName(null)).toBe("other");
    expect(parseBrowserName({})).toBe("other");
  });

  it("acceptance: Firefox manifest asks for nothing beyond Chromium and declares only browsing activity", () => {
    const origin = "https://other.example";
    const firefox = rec(buildFirefoxManifest(origin));
    const chromium = rec(buildManifest(origin));
    const all = (m: Record<string, unknown>) =>
      [...((m["permissions"] as string[]) ?? []), ...((m["host_permissions"] as string[]) ?? [])].sort();
    expect(all(firefox)).toEqual(all(chromium));
    expect(all(firefox)).toContain("https://other.example/*");
    const gecko = rec(rec(firefox["browser_specific_settings"])["gecko"]);
    expect(gecko["data_collection_permissions"]).toEqual({ required: ["browsingActivity"] });
    expect(FIREFOX_MANIFEST_VERSION).toBe(2);
  });

  it("acceptance: badge resolves to browserAction only when action is missing", () => {
    const browserAction = { setBadgeText: () => undefined };
    expect(resolveBadgeApi({ action: undefined, browserAction })).toBe(browserAction);
    expect(resolveBadgeApi({ action: undefined, browserAction: undefined })).toBeUndefined();
  });

  it("acceptance: devices page label for firefox, other values unchanged", () => {
    expect(browserLabel("firefox")).toBe("Firefox");
    expect(browserLabel("chrome")).toBe("Chrome");
    expect(browserLabel("Firefox")).toBe("Other browser");
  });

  it("acceptance: alternating focus between two browsers never exceeds wall time", () => {
    const T = Date.parse("2026-11-17T14:00:00Z");
    const S = 1000;
    const at = (s: number) => T + s * S;
    const ev = (type: "focus" | "tab" | "tick", s: number, extra: object = {}) =>
      ({ type, at: at(s), ...extra }) as TrackerEvent;
    let a = applyEvent(applyEvent(createTracker(), ev("focus", 0, { focused: true })), ev("tab", 0, { url: "https://a.example/" }));
    let b = applyEvent(createTracker(), ev("tab", 0, { url: "https://b.example/" }));
    // handoff every 20 s: A has it 0-20, 40-60, 80-100 = 60 s; B 20-40, 60-80 and 100-110 = 50 s; 60 + 50 = 110 s wall
    for (let s = 20; s <= 100; s += 20) {
      const aHas = (s / 20) % 2 === 0;
      a = applyEvent(a, ev("focus", s, { focused: aHas }));
      b = applyEvent(b, ev("focus", s, { focused: !aHas }));
    }
    a = applyEvent(a, ev("tick", 110));
    b = applyEvent(b, ev("tick", 110));
    const sum = (state: typeof a) => takeCompletedEntries(state, at(600)).entries.reduce((n, e) => n + e.seconds, 0);
    expect(sum(a)).toBe(60);
    expect(sum(b)).toBe(50);
  });
});
