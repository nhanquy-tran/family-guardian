import { describe, expect, it, vi } from "vitest";
import { addChild, deleteChild, listChildren, renameChild } from "./children";

type Client = Parameters<typeof addChild>[0];
type Result = { data?: unknown; error: unknown };
type Call = { table: string; ops: [string, unknown[]][] };

const NAME_ERROR = "Name must be 1 to 50 characters";
const DB_MESSAGE = "secret-db-failure-text";

/** Records every from() call and the chained operations; resolves per table. */
function fakeClient(results: Record<string, Result>) {
  const calls: Call[] = [];
  const from = vi.fn((table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const result = results[table] ?? { data: null, error: null };
    const chain: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown) => resolve(result),
      maybeSingle: () => Promise.resolve(result),
    };
    for (const method of ["select", "insert", "update", "delete", "upsert", "eq", "order"]) {
      chain[method] = (...args: unknown[]) => {
        call.ops.push([method, args]);
        return chain;
      };
    }
    return chain;
  });
  const writes = () => calls.filter((c) => c.ops.some(([m]) => ["insert", "update", "delete", "upsert"].includes(m)));
  return { client: { from } as unknown as Client, from, calls, writes };
}

function expectGenericError(result: { ok: boolean; error?: string }) {
  expect(result.ok).toBe(false);
  expect(result.error).toBeTruthy();
  expect(result.error).not.toContain(DB_MESSAGE);
}

describe("addChild", () => {
  it("Valid name is inserted into the parent's family", async () => {
    const f = fakeClient({ parents: { data: { family_id: "fam-1" }, error: null }, children: { error: null } });
    expect(await addChild(f.client, "  Minh  ")).toEqual({ ok: true });
    const inserts = f.calls.filter((c) => c.table === "children" && c.ops.some(([m]) => m === "insert"));
    expect(inserts).toHaveLength(1);
    expect(inserts[0].ops).toContainEqual(["insert", [{ family_id: "fam-1", name: "Minh" }]]);
  });

  it("Invalid names are rejected before the database", async () => {
    const f = fakeClient({});
    for (const name of ["", "   ", "x".repeat(51)]) {
      expect(await addChild(f.client, name)).toEqual({ ok: false, error: NAME_ERROR });
    }
    expect(f.from).not.toHaveBeenCalled();
  });

  it("Database error is reported", async () => {
    const f = fakeClient({
      parents: { data: { family_id: "fam-1" }, error: null },
      children: { error: { message: DB_MESSAGE } },
    });
    expectGenericError(await addChild(f.client, "Minh"));
  });

  it("No family for this account", async () => {
    const f = fakeClient({ parents: { data: null, error: null } });
    expect(await addChild(f.client, "Minh")).toEqual({ ok: false, error: "No family for this account" });
    expect(f.writes()).toHaveLength(0);
  });
});

describe("renameChild", () => {
  it("Rename updates only the name", async () => {
    const f = fakeClient({ children: { error: null } });
    expect(await renameChild(f.client, "child-1", " An ")).toEqual({ ok: true });
    expect(f.writes()).toHaveLength(1);
    expect(f.writes()[0]).toEqual({
      table: "children",
      ops: [
        ["update", [{ name: "An" }]],
        ["eq", ["id", "child-1"]],
      ],
    });
  });

  it("Rename with invalid name", async () => {
    const f = fakeClient({ children: { error: null } });
    expect(await renameChild(f.client, "child-1", "")).toEqual({ ok: false, error: NAME_ERROR });
    expect(f.writes()).toHaveLength(0);
  });

  it("Rename database error is reported", async () => {
    const f = fakeClient({ children: { error: { message: DB_MESSAGE } } });
    expectGenericError(await renameChild(f.client, "child-1", "An"));
  });
});

describe("deleteChild", () => {
  it("Delete by id", async () => {
    const f = fakeClient({ children: { error: null } });
    expect(await deleteChild(f.client, "child-1")).toEqual({ ok: true });
    expect(f.calls).toEqual([
      {
        table: "children",
        ops: [
          ["delete", []],
          ["eq", ["id", "child-1"]],
        ],
      },
    ]);
  });

  it("Delete database error is reported", async () => {
    const f = fakeClient({ children: { error: { message: DB_MESSAGE } } });
    expectGenericError(await deleteChild(f.client, "child-1"));
  });

  it("Confirm deletes", async () => {
    const f = fakeClient({ children: { error: null } });
    expect(await deleteChild(f.client, "c1")).toEqual({ ok: true });
    expect(f.calls[0]).toEqual({
      table: "children",
      ops: [
        ["delete", []],
        ["eq", ["id", "c1"]],
      ],
    });
  });
});

describe("listChildren", () => {
  it("Ordered list", async () => {
    const rows = [
      { id: "c1", name: "Minh", created_at: "2026-11-17T09:00:00Z" },
      { id: "c2", name: "An", created_at: "2026-11-17T10:00:00Z" },
    ];
    const f = fakeClient({ children: { data: rows, error: null } });
    expect(await listChildren(f.client)).toEqual(rows);
    expect(f.calls[0].table).toBe("children");
    expect(f.calls[0].ops).toContainEqual(["order", ["created_at"]]);
  });

  it("Error gives an empty list", async () => {
    const f = fakeClient({ children: { data: null, error: { message: DB_MESSAGE } } });
    expect(await listChildren(f.client)).toEqual([]);
  });
});
