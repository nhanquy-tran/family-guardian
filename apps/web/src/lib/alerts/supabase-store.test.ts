import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createOfflineAlertStore } from "./supabase-store";

type Row = Record<string, unknown>;
type Call = { method: string; args: unknown[] };
type Result = { data?: unknown; error?: unknown };
type Tables = Record<string, Row[]>;

/**
 * Chainable in-memory fake of the Supabase query builder. It records every call and applies
 * eq/neq/gt/gte/lt/lte/is/not/in filters to `tables`, so the result follows from the query the store builds.
 * `results` overrides the response for a table (or rpc name) and `error` makes every call fail.
 */
function fakeClient(opts: { tables?: Tables; rpc?: Record<string, Result>; users?: Record<string, string | null>; error?: boolean; inserted?: boolean } = {}) {
  const calls: Record<string, Call[]> = {};
  const record = (key: string, method: string, args: unknown[]) => (calls[key] ??= []).push({ method, args });

  const compare = (a: unknown, b: unknown) => Date.parse(String(a)) - Date.parse(String(b));
  const apply = (rows: Row[], f: Call): Row[] => {
    const [col, a, b] = f.args as [string, unknown, unknown];
    switch (f.method) {
      case "eq": return rows.filter((r) => r[col] === a);
      case "neq": return rows.filter((r) => r[col] !== a);
      case "gt": return rows.filter((r) => r[col] != null && compare(r[col], a) > 0);
      case "gte": return rows.filter((r) => r[col] != null && compare(r[col], a) >= 0);
      case "lt": return rows.filter((r) => r[col] != null && compare(r[col], a) < 0);
      case "lte": return rows.filter((r) => r[col] != null && compare(r[col], a) <= 0);
      case "is": return rows.filter((r) => (r[col] ?? null) === a);
      case "not": return b === null ? rows.filter((r) => r[col] != null) : rows;
      case "in": return rows.filter((r) => (a as unknown[]).includes(r[col]));
      default: return rows;
    }
  };

  const query = (table: string) => {
    const filters: Call[] = [];
    let mutation: string | null = null;
    const builder: Record<string, unknown> = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => {
            if (opts.error) return resolve({ data: null, error: { message: "db error" }, count: null });
            let rows = opts.tables?.[table] ?? [];
            for (const f of filters) rows = apply(rows, f);
            if (mutation === "insert" || mutation === "upsert") {
              rows = opts.inserted === false ? [] : [{ id: "new" }];
            }
            resolve({ data: rows, error: null, count: rows.length });
          };
        }
        return (...args: unknown[]) => {
          record(table, prop, args);
          if (["insert", "upsert", "delete", "update"].includes(prop)) mutation = prop;
          else filters.push({ method: prop, args });
          if (prop === "maybeSingle" || prop === "single") {
            return {
              then: (resolve: (v: unknown) => void) => {
                if (opts.error) return resolve({ data: null, error: { message: "db error" } });
                let rows = opts.tables?.[table] ?? [];
                for (const f of filters) rows = apply(rows, f);
                resolve({ data: rows[0] ?? null, error: null });
              },
            };
          }
          return builder;
        };
      },
    });
    return builder;
  };

  const client = {
    from: vi.fn((table: string) => query(table)),
    rpc: vi.fn(async (name: string, args: unknown) => {
      record(`rpc:${name}`, "call", [args]);
      if (opts.error) return { data: null, error: { message: "db error" } };
      return { data: [], error: null, ...opts.rpc?.[name] };
    }),
    auth: {
      admin: {
        getUserById: vi.fn(async (id: string) => {
          if (opts.error) return { data: { user: null }, error: { message: "auth error" } };
          const email = opts.users?.[id];
          return { data: { user: email === undefined ? null : { id, email } }, error: null };
        }),
      },
    },
  };
  return { client: client as unknown as SupabaseClient, calls, raw: client };
}

describe("createOfflineAlertStore", () => {
  it("Claim without e-mail", async () => {
    const f = fakeClient();
    const store = createOfflineAlertStore(f.client);
    const lastSeen = "2026-11-17T11:40:00.000Z";

    expect(await store.claimAlert("dev-1", lastSeen, null)).toBe(true);
    const write = (f.calls.alerts ?? []).find((c) => c.method === "insert" || c.method === "upsert");
    expect(write).toBeDefined();
    expect(write!.args[0]).toEqual({ device_id: "dev-1", kind: "offline", incident_last_seen_at: lastSeen, emailed_at: null });
    expect(JSON.stringify(write!.args[1] ?? {})).toContain("ignoreDuplicates");

    const lost = fakeClient({ inserted: false });
    expect(await createOfflineAlertStore(lost.client).claimAlert("dev-1", lastSeen, null)).toBe(false);
  });

  it("Resolving returned devices calls resolve_offline_alerts with the given time", async () => {
    const f = fakeClient();
    await createOfflineAlertStore(f.client).resolveReturned("2026-11-17T12:00:00.000Z");
    expect(f.raw.rpc).toHaveBeenCalledWith("resolve_offline_alerts", { p_now: "2026-11-17T12:00:00.000Z" });
  });

  it("Client error", async () => {
    const f = fakeClient({ error: true });
    const store = createOfflineAlertStore(f.client);
    await expect(store.findOfflineDevices("2026-11-17T12:00:00.000Z")).rejects.toBeDefined();
    await expect(store.claimAlert("dev-1", "2026-11-17T11:40:00.000Z", null)).rejects.toBeDefined();
    await expect(store.resolveReturned("2026-11-17T12:00:00.000Z")).rejects.toBeDefined();
  });

  it("Device search calls find_offline_devices with the given time", async () => {
    const f = fakeClient();
    await createOfflineAlertStore(f.client).findOfflineDevices("2026-11-17T12:00:00.000Z");
    expect(f.raw.rpc).toHaveBeenCalledWith("find_offline_devices", { p_now: "2026-11-17T12:00:00.000Z" });
  });
});
