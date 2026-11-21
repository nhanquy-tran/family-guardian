import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { activeOfflineAlerts, loadActiveOfflineAlerts, type BannerAlert } from "./banner";

const alert = (id: string, sentAt: string, incident: string, lastSeen: string | null): BannerAlert => ({
  id,
  sent_at: sentAt,
  incident_last_seen_at: incident,
  resolved_at: null,
  devices: { last_seen_at: lastSeen, browser: "Edge", os: "Windows", children: { name: "Mia" } },
});

const A = alert("A", "2026-11-17T11:55:00.000Z", "2026-11-17T11:40:00.000Z", "2026-11-17T11:40:00.000Z");
const B = alert("B", "2026-11-17T11:50:00.000Z", "2026-11-17T11:30:00.000Z", "2026-11-17T11:55:00.000Z");

// Chainable fake of the RLS client: every builder method returns the chain, awaiting it gives the result.
function fakeClient(result: { data: unknown; error: unknown } | "throw") {
  const chain: Record<string, unknown> = {};
  const builder = new Proxy(chain, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
          result === "throw" ? reject(new Error("boom")) : resolve(result);
      }
      return vi.fn(() => builder);
    },
  });
  return { from: vi.fn(() => builder) } as unknown as SupabaseClient;
}

describe("activeOfflineAlerts", () => {
  it("Active and resolved alerts", () => {
    expect(activeOfflineAlerts([A, B])).toEqual([A]);
  });

  it("Alert resolved by another browser", () => {
    const resolved = { ...A, resolved_at: "2026-11-17T12:00:00.000Z" };
    expect(activeOfflineAlerts([resolved])).toEqual([]);
  });

  it("Ordering and empty", () => {
    const older = alert("older", "2026-11-17T10:00:00.000Z", "2026-11-17T09:40:00.000Z", "2026-11-17T09:40:00.000Z");
    const newer = alert("newer", "2026-11-17T11:55:00.000Z", "2026-11-17T11:40:00.000Z", "2026-11-17T11:40:00.000Z");
    expect(activeOfflineAlerts([older, newer]).map((a) => a.id)).toEqual(["newer", "older"]);
    expect(activeOfflineAlerts([])).toEqual([]);
  });
});

describe("loadActiveOfflineAlerts", () => {
  it("Banner query failure", async () => {
    await expect(loadActiveOfflineAlerts(fakeClient({ data: null, error: { message: "rls" } }))).resolves.toEqual([]);
    await expect(loadActiveOfflineAlerts(fakeClient("throw"))).resolves.toEqual([]);
  });

  it("Banner loader keeps only active alerts", async () => {
    const rows = await loadActiveOfflineAlerts(fakeClient({ data: [B, A], error: null }));
    expect(rows.map((r) => r.id)).toEqual(["A"]);
  });
});
