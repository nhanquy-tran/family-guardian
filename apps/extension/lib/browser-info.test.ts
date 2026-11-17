import { describe, expect, it } from "vitest";
import { detectBrowser, osName } from "./browser-info";

const chromeUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";

describe("detectBrowser", () => {
  it("browsers", () => {
    expect(detectBrowser({ brands: [], userAgent: chromeUa, isBrave: true })).toBe("brave");
    expect(detectBrowser({ brands: ["Microsoft Edge", "Chromium"], userAgent: "", isBrave: false })).toBe("edge");
    expect(detectBrowser({ brands: [], userAgent: `${chromeUa} Edg/130.0`, isBrave: false })).toBe("edge");
    expect(detectBrowser({ brands: [], userAgent: `${chromeUa} OPR/115.0`, isBrave: false })).toBe("other");
    expect(detectBrowser({ brands: ["Google Chrome", "Chromium"], userAgent: "", isBrave: false })).toBe("chrome");
    expect(detectBrowser({ brands: [], userAgent: chromeUa, isBrave: false })).toBe("chrome");
    expect(detectBrowser({ brands: [], userAgent: "Mozilla/5.0 (X11) Firefox/130.0", isBrave: false })).toBe("other");
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
