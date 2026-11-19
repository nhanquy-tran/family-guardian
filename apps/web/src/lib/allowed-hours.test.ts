import { describe, expect, it, vi } from "vitest";
import { saveAllowedHours } from "./allowed-hours";

type Client = Parameters<typeof saveAllowedHours>[0];
type Call = { table: string; ops: [string, unknown[]][] };

const CHILD = "child-1";

function fakeClient(mode: "ok" | "none" | "error" | "throws" = "ok") {
  const calls: Call[] = [];
  const from = vi.fn((table: string) => {
    if (mode === "throws") throw new Error("network down");
    const call: Call = { table, ops: [] };
    calls.push(call);
    const chain: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(
          mode === "error"
            ? { data: null, error: { message: "secret" } }
            : { data: mode === "none" ? [] : [{ id: CHILD }], error: null },
        ).then(resolve, reject),
    };
    for (const method of ["update", "eq", "select"]) {
      chain[method] = (...args: unknown[]) => {
        call.ops.push([method, args]);
        return chain;
      };
    }
    return chain;
  });
  return { client: { from } as unknown as Client, calls };
}

describe("saveAllowedHours", () => {
  it("Valid window saved and empty clears", async () => {
    const f = fakeClient();
    expect(await saveAllowedHours(f.client, CHILD, { start: " 07:00 ", end: "01:00" })).toEqual({ ok: true });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]?.table).toBe("children");
    expect(f.calls[0]?.ops).toContainEqual(["update", [{ allowed_start: "07:00", allowed_end: "01:00" }]]);
    expect(f.calls[0]?.ops).toContainEqual(["eq", ["id", CHILD]]);

    const g = fakeClient();
    expect(await saveAllowedHours(g.client, CHILD, { start: "", end: " " })).toEqual({ ok: true });
    expect(g.calls).toHaveLength(1);
    expect(g.calls[0]?.ops).toContainEqual(["update", [{ allowed_start: null, allowed_end: null }]]);
  });

  it("Invalid input writes nothing", async () => {
    const cases: [string, string][] = [
      ["07:00", ""],
      ["", "21:00"],
      ["7:00", "21:00"],
      ["24:00", "01:00"],
      ["07:60", "21:00"],
      ["08:00", "08:00"],
    ];
    for (const [start, end] of cases) {
      const f = fakeClient();
      expect(await saveAllowedHours(f.client, CHILD, { start, end }), `${start}-${end}`).toEqual({
        ok: false,
        error: "invalid_hours",
      });
      expect(f.calls).toHaveLength(0);
    }
  });

  it("Store failure", async () => {
    for (const mode of ["error", "throws"] as const) {
      const f = fakeClient(mode);
      expect(await saveAllowedHours(f.client, CHILD, { start: "07:00", end: "21:00" })).toEqual({
        ok: false,
        error: "failed",
      });
    }
  });

  it("Hours for a child the parent cannot see", async () => {
    const f = fakeClient("none");
    expect(await saveAllowedHours(f.client, CHILD, { start: "07:00", end: "21:00" })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(f.calls[0]?.ops).toContainEqual(["select", ["id"]]);
  });
});
