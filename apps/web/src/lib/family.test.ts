import { describe, expect, it, vi } from "vitest";
import { getFamilyName, type FamilyClient } from "./family";

type Row = { data: { families: { name: string | null } | null } | null; error: unknown };

function fakeClient(result: Row) {
  const maybeSingle = vi.fn(async () => result);
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn();
  const update = vi.fn();
  const upsert = vi.fn();
  const from = vi.fn((_table: string) => ({ select, insert, update, upsert }));
  return { client: { from } as unknown as FamilyClient, from, select, insert, update, upsert };
}

describe("getFamilyName", () => {
  it("family created on first sign-in is shown", async () => {
    const f = fakeClient({ data: { families: { name: "Tran family" } }, error: null });
    expect(await getFamilyName(f.client)).toBe("Tran family");
    expect(f.from.mock.calls.every(([table]) => table === "parents")).toBe(true);
    expect(f.select).toHaveBeenCalledWith("families(name)");
    expect(f.insert).not.toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
    expect(f.upsert).not.toHaveBeenCalled();
  });

  it("missing family falls back", async () => {
    const results: Row[] = [
      { data: null, error: null },
      { data: { families: { name: "" } }, error: null },
      { data: null, error: new Error("query failed") },
    ];
    for (const result of results) {
      expect(await getFamilyName(fakeClient(result).client)).toBe("My family");
    }
  });
});
