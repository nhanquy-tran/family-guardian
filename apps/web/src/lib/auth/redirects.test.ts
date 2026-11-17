import { describe, expect, it } from "vitest";
import { authRedirect } from "./redirects";

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
