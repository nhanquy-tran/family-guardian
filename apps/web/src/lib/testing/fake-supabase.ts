import type { SupabaseClient } from "@supabase/supabase-js";

export type FakeError = { code?: string; message: string };
export type FakeResult = { data?: unknown; error?: FakeError | null };
export type FakeCall = { table: string; ops: [string, unknown[]][] };
export type Resolver = (call: FakeCall) => FakeResult;

const CHAIN = ["select", "insert", "update", "delete", "upsert", "eq", "in", "gt", "not", "order", "range"];
const WRITES = ["insert", "update", "delete", "upsert"];

export const RLS_VIOLATION: FakeError = { code: "42501", message: "new row violates row-level security policy" };
export const DB_ERROR: FakeError = { code: "XX000", message: "secret-db-failure-text" };

/**
 * What PostgREST gives a request without a session: RLS rejects inserts and upserts,
 * and reads, updates and deletes match no rows.
 */
export const anonymous: Resolver = (call) => {
  const methods = call.ops.map(([m]) => m);
  if (methods.includes("insert") || methods.includes("upsert")) return { data: null, error: RLS_VIOLATION };
  if (methods.includes("maybeSingle")) return { data: null, error: null };
  if (methods.includes("select")) return { data: [], error: null };
  return { data: null, error: null };
};

/** Results per table; an array is consumed in call order (the last entry repeats). */
export function byTable(results: Record<string, FakeResult | FakeResult[]>): Resolver {
  const used: Record<string, number> = {};
  return ({ table }) => {
    const entry = results[table];
    if (!Array.isArray(entry)) return entry ?? { data: null, error: null };
    const index = Math.min(used[table] ?? 0, entry.length - 1);
    used[table] = (used[table] ?? 0) + 1;
    return entry[index] ?? { data: null, error: null };
  };
}

/** Records every from() call and its chained operations; each awaited chain is answered by `resolve`. */
export function fakeSupabase(resolve: Resolver = byTable({}), user: { id: string } | null = { id: "user-1" }) {
  const calls: FakeCall[] = [];
  const from = (table: string) => {
    const call: FakeCall = { table, ops: [] };
    calls.push(call);
    const settle = () => {
      try {
        return Promise.resolve(resolve(call));
      } catch (error) {
        return Promise.reject(error);
      }
    };
    const chain: Record<string, unknown> = {
      then: (onFulfilled: (value: FakeResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
        settle().then(onFulfilled, onRejected),
      maybeSingle: () => {
        call.ops.push(["maybeSingle", []]);
        return settle();
      },
    };
    for (const method of CHAIN) {
      chain[method] = (...args: unknown[]) => {
        call.ops.push([method, args]);
        return chain;
      };
    }
    return chain;
  };
  const auth = { getUser: async () => ({ data: { user }, error: null }) };
  const writes = () => calls.filter((c) => c.ops.some(([m]) => WRITES.includes(m)));
  return { client: { from, auth } as unknown as SupabaseClient, calls, writes };
}
