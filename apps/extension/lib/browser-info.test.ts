import { describe, expect, it } from "vitest";
import { detectBrowser, osName, parseBrowserName, resolveBadgeApi } from "./browser-info";

const firefoxUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0";

describe("firefox detection and parsing", () => {
  it("Browsers (firefox)", () => {
    expect(detectBrowser({ brands: [], userAgent: firefoxUa, isBrave: false })).toBe("firefox");
    expect(detectBrowser({ brands: [], userAgent: "Mozilla/5.0 (X11) Safari/605.1", isBrave: false })).toBe("other");
  });

  it("Parsing", () => {
    expect(["firefox", "brave", "netscape", undefined, 42].map(parseBrowserName)).toEqual([
      "firefox",
      "brave",
      "other",
      "other",
      "other",
    ]);
    expect(["chrome", "edge", "other", "Firefox", ""].map(parseBrowserName)).toEqual(["chrome", "edge", "other", "other", "other"]);
  });

  it("Badge API resolution", () => {
    const action = { setBadgeText: () => 1 };
    const browserAction = { setBadgeText: () => 2 };
    expect(resolveBadgeApi({ action, browserAction })).toBe(action);
    expect(resolveBadgeApi({ browserAction })).toBe(browserAction);
    expect(resolveBadgeApi({})).toBeUndefined();
  });
});

const chromeUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";

describe("detectBrowser", () => {
  it("browsers", () => {
    expect(detectBrowser({ brands: [], userAgent: chromeUa, isBrave: true })).toBe("brave");
    expect(detectBrowser({ brands: ["Microsoft Edge", "Chromium"], userAgent: "", isBrave: false })).toBe("edge");
    expect(detectBrowser({ brands: [], userAgent: `${chromeUa} Edg/130.0`, isBrave: false })).toBe("edge");
    expect(detectBrowser({ brands: [], userAgent: `${chromeUa} OPR/115.0`, isBrave: false })).toBe("other");
    expect(detectBrowser({ brands: ["Google Chrome", "Chromium"], userAgent: "", isBrave: false })).toBe("chrome");
    expect(detectBrowser({ brands: [], userAgent: chromeUa, isBrave: false })).toBe("chrome");
    expect(detectBrowser({ brands: [], userAgent: firefoxUa, isBrave: false })).toBe("firefox");
    expect(detectBrowser({ brands: [], userAgent: "Mozilla/5.0 (X11) Safari/605.1", isBrave: false })).toBe("other");
  });
});

describe("osName", () => {
  it("operating systems", () => {
    expect(["win", "mac", "linux", "cros", "android"].map(osName)).toEqual([
      "Windows",
      "macOS",
      "Linux",
      "ChromeOS",
      "other",
    ]);
  });
});
