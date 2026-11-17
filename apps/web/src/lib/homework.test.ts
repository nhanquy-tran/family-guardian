import { describe, expect, it, vi } from "vitest";
import { addHomeworkDomain, removeHomeworkDomain, saveHomeworkCategories } from "./homework";

type Client = Parameters<typeof saveHomeworkCategories>[0];
type Result = { data?: unknown; error: unknown };
type Call = { table: string; ops: [string, unknown[]][] };

const CHILD = "child-1";
const DB_ERROR = { code: "XX000", message: "secret-db-failure-text" };

/**
 * Reads (no update op) resolve `read`: a row object for single()/maybeSingle(), a one-row array when awaited
 * directly. An update resolves `write`.
 */
function fakeClient(opts: { domains?: string[]; read?: Result; write?: Result } = {}) {
  const calls: Call[] = [];
  const read: Result = opts.read ?? { data: { homework_domains: opts.domains ?? [] }, error: null };
  const write: Result = opts.write ?? { data: [{ id: CHILD }], error: null };
  const from = vi.fn((table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const isWrite = () => call.ops.some(([op]) => op === "update");
    const chain: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown, reject?: (e: unknown) => unknown) => {
        const r = isWrite() ? write : { ...read, data: read.data ? [read.data] : read.data };
        return Promise.resolve(r).then(resolve, reject);
      },
      single: () => Promise.resolve(isWrite() ? write : read),
      maybeSingle: () => Promise.resolve(isWrite() ? write : read),
    };
    for (const method of ["select", "update", "eq", "order", "limit"]) {
      chain[method] = (...args: unknown[]) => {
        call.ops.push([method, args]);
        return chain;
      };
    }
    return chain;
  });
  const updates = () => calls.filter((c) => c.ops.some(([m]) => m === "update"));
  const written = () => updates().map((c) => c.ops.find(([m]) => m === "update")?.[1][0]);
  return { client: { from } as unknown as Client, updates, written };
}

describe("homework settings management", () => {
  it("Save categories", async () => {
    const f = fakeClient();
    expect(await saveHomeworkCategories(f.client, CHILD, ["education", "productivity"])).toEqual({ ok: true });
    expect(f.written()).toEqual([{ homework_categories: ["education", "productivity"] }]);
    expect(f.updates()[0]?.table).toBe("children");
    expect(f.updates()[0]?.ops).toContainEqual(["eq", ["id", CHILD]]);
  });

  it("Unknown category rejected", async () => {
    const f = fakeClient();
    expect(await saveHomeworkCategories(f.client, CHILD, ["education", "music"])).toEqual({ ok: false, error: "invalid_category" });
    expect(f.updates()).toHaveLength(0);
  });

  it("Add domain normalizes", async () => {
    const f = fakeClient({ domains: ["a.org"] });
    expect(await addHomeworkDomain(f.client, CHILD, " https://www.Khanacademy.org/x ")).toEqual({ ok: true });
    expect(f.written()).toEqual([{ homework_domains: ["a.org", "khanacademy.org"] }]);
  });

  it("Invalid, duplicate and too many domains", async () => {
    const invalid = fakeClient({ domains: ["a.org"] });
    expect(await addHomeworkDomain(invalid.client, CHILD, "not a domain")).toEqual({ ok: false, error: "invalid_domain" });
    expect(invalid.updates()).toHaveLength(0);

    const duplicate = fakeClient({ domains: ["khanacademy.org"] });
    expect(await addHomeworkDomain(duplicate.client, CHILD, "khanacademy.org")).toEqual({ ok: false, error: "duplicate" });
    expect(duplicate.updates()).toHaveLength(0);

    const full = fakeClient({ domains: Array.from({ length: 50 }, (_, i) => `site${i}.example.org`) });
    expect(await addHomeworkDomain(full.client, CHILD, "new.example.org")).toEqual({ ok: false, error: "too_many" });
    expect(full.updates()).toHaveLength(0);
  });

  it("Remove domain", async () => {
    const f = fakeClient({ domains: ["a.org", "b.org"] });
    expect(await removeHomeworkDomain(f.client, CHILD, "a.org")).toEqual({ ok: true });
    expect(f.written()).toEqual([{ homework_domains: ["b.org"] }]);
  });

  it("Store failure and unknown child", async () => {
    const readFails = fakeClient({ read: { data: null, error: DB_ERROR } });
    expect(await addHomeworkDomain(readFails.client, CHILD, "a.org")).toEqual({ ok: false, error: "failed" });
    expect(readFails.updates()).toHaveLength(0);

    const readFailsOnRemove = fakeClient({ read: { data: null, error: DB_ERROR } });
    expect(await removeHomeworkDomain(readFailsOnRemove.client, CHILD, "a.org")).toEqual({ ok: false, error: "failed" });

    const updateFails = fakeClient({ domains: [], write: { data: null, error: DB_ERROR } });
    expect(await addHomeworkDomain(updateFails.client, CHILD, "a.org")).toEqual({ ok: false, error: "failed" });
    const categoriesFail = fakeClient({ write: { data: null, error: DB_ERROR } });
    expect(await saveHomeworkCategories(categoriesFail.client, CHILD, ["education"])).toEqual({ ok: false, error: "failed" });

    const noRows = fakeClient({ domains: [], write: { data: [], error: null } });
    expect(await addHomeworkDomain(noRows.client, CHILD, "a.org")).toEqual({ ok: false, error: "not_found" });
    const noRowsCategories = fakeClient({ write: { data: [], error: null } });
    expect(await saveHomeworkCategories(noRowsCategories.client, CHILD, ["education"])).toEqual({ ok: false, error: "not_found" });
  });
});
