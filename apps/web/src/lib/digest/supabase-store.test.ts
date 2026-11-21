import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createDigestSource } from "./supabase-store";

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

// In-memory client: honours in/eq/gte/lt like PostgREST, so the store must ask for the period itself.
function fakeClient(tables: Record<string, Row[]>, failTable?: string) {
  return {
    from(table: string) {
      const filters: Filter[] = [];
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      const time = (v: unknown) => Date.parse(String(v));
      builder.select = chain;
      builder.order = chain;
      builder.eq = (col: string, v: unknown) => (filters.push((r) => r[col] === v), builder);
      builder.in = (col: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[col])), builder);
      builder.gte = (col: string, v: unknown) => (filters.push((r) => time(r[col]) >= time(v)), builder);
      builder.lt = (col: string, v: unknown) => (filters.push((r) => time(r[col]) < time(v)), builder);
      builder.then = (resolve: (v: unknown) => void) =>
        resolve(
          table === failTable
            ? { data: null, error: { message: "boom" } }
            : { data: (tables[table] ?? []).filter((r) => filters.every((f) => f(r))), error: null },
        );
      return builder;
    },
  } as unknown as SupabaseClient;
}

const devices = [
  { id: "d1", child_id: "c-mia", browser: "firefox", os: "Windows" },
  { id: "d2", child_id: "c-mia", browser: "chrome", os: "Windows" },
  { id: "d3", child_id: "c-leo", browser: "edge", os: "Windows" },
];
const START = "2026-11-17T00:00:00.000Z";
const END = "2026-11-18T00:00:00.000Z";

describe("createDigestSource site access", () => {
  it("Store reads the family's incidents in the period", async () => {
    const incidents = [
      { device_id: "d1", started_at: "2026-11-16T23:00:00.000Z", resolved_at: "2026-11-16T23:30:00.000Z" }, // before
      { device_id: "d2", started_at: "2026-11-17T13:00:00.000Z", resolved_at: null }, // inside
      { device_id: "d3", started_at: "2026-11-18T01:00:00.000Z", resolved_at: null }, // after
    ];
    const source = createDigestSource(fakeClient({ devices, site_access_incidents: incidents }));
    const found = await source.listSiteAccessIncidents(["c-mia", "c-leo"], START, END);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ childId: "c-mia", os: "Windows", startedAt: "2026-11-17T13:00:00.000Z", resolvedAt: null });
    expect(found[0]!.browser).toMatch(/chrome/i);

    const broken = createDigestSource(fakeClient({ devices, site_access_incidents: incidents }, "site_access_incidents"));
    await expect(broken.listSiteAccessIncidents(["c-mia"], START, END)).rejects.toBeDefined();
  });
});
