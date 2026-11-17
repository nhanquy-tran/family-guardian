import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { authRedirect } from "./redirects";

describe("public privacy page", () => {
  it("No redirect for anonymous visitors", () => {
    expect(authRedirect("/privacy", false)).toBeNull();
    const proxy = readFileSync(join(__dirname, "..", "..", "proxy.ts"), "utf8");
    const matcher = proxy.match(/matcher:\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect(matcher).not.toBe("");
    expect(matcher).not.toContain("privacy");
    // only explicit dashboard/login paths; a catch-all would also match /privacy
    for (const entry of matcher.match(/"[^"]*"/g) ?? []) {
      expect(entry).toMatch(/^"\/(dashboard|login)/);
    }
  });
});

describe("authRedirect", () => {
  it("signed-out user visits the dashboard", () => {
    for (const p of ["/dashboard", "/dashboard/devices", "/dashboard/children/123"]) {
      expect(authRedirect(p, false)).toBe("/login");
    }
  });

  it("signed-in user visits the dashboard", () => {
    expect(authRedirect("/dashboard/devices", true)).toBeNull();
  });

  it("signed-in user visits login", () => {
    expect(authRedirect("/login", true)).toBe("/dashboard");
  });

  it("public pages are not redirected", () => {
    for (const p of ["/login", "/", "/privacy", "/dashboardx"]) {
      expect(authRedirect(p, false)).toBeNull();
    }
  });
});
