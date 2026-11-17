import { describe, expect, it } from "vitest";
import { authRedirect } from "./redirects";

describe("authRedirect", () => {
  it("signed-out user visits the dashboard", () => {
    for (const path of ["/dashboard", "/dashboard/devices", "/dashboard/children/123"]) {
      expect(authRedirect(path, false)).toBe("/login");
    }
  });

  it("signed-in user visits the dashboard", () => {
    expect(authRedirect("/dashboard/devices", true)).toBeNull();
  });

  it("signed-in user visits login", () => {
    expect(authRedirect("/login", true)).toBe("/dashboard");
  });

  it("public pages are not redirected", () => {
    for (const path of ["/login", "/", "/privacy", "/dashboardx"]) {
      expect(authRedirect(path, false)).toBeNull();
    }
  });
});
