import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { loadSiteAccessLost, siteAccessLostLines, type SiteAccessLostRow } from "./site-access-banner";

const row = (child: string, browser: string, name: string | null): SiteAccessLostRow => ({
  name,
  browser,
  os: "Windows",
  children: { name: child },
});

const FALSE_ROWS = [
  row("Mia", "firefox", null),
  row("Leo", "chrome", "School laptop"),
  row("Mia", "chrome", "Z laptop"),
  row("Mia", "chrome", "A laptop"),
];

const SUFFIX = ": site access was turned off";

// Chainable fake of the RLS client that records every call; awaiting the chain gives the result.
function fakeClient(result: { data: unknown; error: unknown } | "throw") {
  const calls: { method: string; args: unknown[] }[] = [];
  const from = vi.fn((table: string) => {
    calls.push({ method: "from", args: [table] });
    return builder;
  });
  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            result === "throw" ? reject(new Error("boom")) : resolve(result);
        }
        return (...args: unknown[]) => {
          calls.push({ method: String(prop), args });
          return builder;
        };
      },
    },
  );
  return { client: { from } as unknown as SupabaseClient, calls };
}

describe("site access banner lines", () => {
  it("Lines, order and loader", async () => {
    expect(siteAccessLostLines(FALSE_ROWS)).toEqual([
      `Blocking is off on School laptop${SUFFIX}`,
      `Blocking is off on A laptop${SUFFIX}`,
      `Blocking is off on Z laptop${SUFFIX}`,
      `Blocking is off on Mia's Firefox on Windows${SUFFIX}`,
    ]);
    expect(siteAccessLostLines([])).toEqual([]);

    const ok = fakeClient({ data: FALSE_ROWS, error: null });
    const lines = await loadSiteAccessLost(ok.client);
    expect(lines).toHaveLength(4);
    expect(ok.calls[0]).toEqual({ method: "from", args: ["devices"] });
    expect(ok.calls).toContainEqual({ method: "eq", args: ["site_access", false] });

    const failing = fakeClient({ data: null, error: { message: "rls" } });
    await expect(loadSiteAccessLost(failing.client)).resolves.toEqual([]);
    await expect(loadSiteAccessLost(fakeClient("throw").client)).resolves.toEqual([]);
  });
});
