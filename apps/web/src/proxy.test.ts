import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CookieSetter = (list: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
type CookieGetter = () => { name: string; value: string }[];

const auth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  refreshed: [] as { name: string; value: string; options?: Record<string, unknown> }[],
  created: [] as { url: string; key: string }[],
  seen: [] as { name: string; value: string }[],
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (url: string, key: string, options: { cookies: { getAll: CookieGetter; setAll: CookieSetter } }) => {
    auth.created.push({ url, key });
    return {
      auth: {
        getUser: async () => {
          auth.seen = options.cookies.getAll();
          if (auth.refreshed.length > 0) options.cookies.setAll(auth.refreshed);
          return { data: { user: auth.user }, error: null };
        },
      },
    };
  },
}));

import { config, proxy } from "./proxy";

const ORIGIN = "https://app.example.test";
const request = (path: string) => new NextRequest(new URL(path, ORIGIN));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  auth.user = null;
  auth.refreshed = [];
  auth.created = [];
  auth.seen = [];
});

afterEach(() => vi.unstubAllEnvs());

describe("proxy", () => {
  it("Signed-out user visits the dashboard", async () => {
    for (const path of ["/dashboard", "/dashboard/devices", "/dashboard/children/123/rules?error=failed"]) {
      const response = await proxy(request(path));
      expect(getRedirectUrl(response), path).toBe(`${ORIGIN}/login`);
    }
    expect(auth.created[0]).toEqual({ url: "https://db.example.test", key: "anon-key" });
  });

  it("Signed-in user visits the dashboard", async () => {
    auth.user = { id: "user-1" };
    const response = await proxy(request("/dashboard/devices"));
    expect(getRedirectUrl(response)).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("Signed-in user visits login", async () => {
    auth.user = { id: "user-1" };
    expect(getRedirectUrl(await proxy(request("/login")))).toBe(`${ORIGIN}/dashboard`);
  });

  it("Public pages are not redirected", async () => {
    for (const path of ["/login", "/", "/privacy", "/dashboardx"]) {
      expect(getRedirectUrl(await proxy(request(path))), path).toBeNull();
    }
  });

  it("reads the session from the request cookies", async () => {
    const req = request("/dashboard");
    req.cookies.set("sb-auth", "session");
    await proxy(req);
    expect(auth.seen).toEqual([{ name: "sb-auth", value: "session" }]);
  });

  it("refreshed session cookies are kept on a pass-through", async () => {
    auth.user = { id: "user-1" };
    auth.refreshed = [{ name: "sb-auth", value: "fresh", options: { httpOnly: true, path: "/" } }];
    const response = await proxy(request("/dashboard"));
    expect(getRedirectUrl(response)).toBeNull();
    const cookie = response.cookies.get("sb-auth");
    expect(cookie?.value).toBe("fresh");
    expect(cookie?.httpOnly).toBe(true);
  });

  it("refreshed session cookies are kept on a redirect", async () => {
    auth.refreshed = [{ name: "sb-auth", value: "", options: { maxAge: 0, path: "/" } }];
    const response = await proxy(request("/dashboard/settings"));
    expect(getRedirectUrl(response)).toBe(`${ORIGIN}/login`);
    expect(response.cookies.get("sb-auth")?.value).toBe("");
  });

  it("fails closed without Supabase configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    await expect(proxy(request("/dashboard"))).rejects.toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });
});

describe("proxy matcher", () => {
  const matches = (path: string) => unstable_doesMiddlewareMatch({ config, url: `${ORIGIN}${path}` });

  it("runs on the dashboard, its server actions and the login page", () => {
    for (const path of ["/dashboard", "/dashboard/children", "/dashboard/children/abc/homework", "/login"]) {
      expect(matches(path), path).toBe(true);
    }
  });

  it("skips public, localised, API and static paths", () => {
    for (const path of [
      "/",
      "/en",
      "/de/faq",
      "/vi/setup",
      "/privacy",
      "/install",
      "/api/device/heartbeat",
      "/auth/callback",
      "/_next/static/chunks/app.js",
      "/favicon.ico",
      "/robots.txt",
      "/dashboardx",
    ]) {
      expect(matches(path), path).toBe(false);
    }
  });
});
