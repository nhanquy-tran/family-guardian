import { describe, expect, it, vi } from "vitest";
import { getFamilyName } from "./family";

type Client = Parameters<typeof getFamilyName>[0];

function fakeClient(result: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const insert = vi.fn();
  const update = vi.fn();
  const upsert = vi.fn();
  const from = vi.fn().mockReturnValue({ select, insert, update, upsert });
  return { client: { from } as unknown as Client, from, select, insert, update, upsert };
}

describe("getFamilyName", () => {
  it("family created on first sign-in is shown", async () => {
    const f = fakeClient({ data: { families: { name: "Tran family" } }, error: null });
    expect(await getFamilyName(f.client)).toBe("Tran family");
    expect(f.from).toHaveBeenCalled();
    expect(f.from.mock.calls.every((c) => c[0] === "parents")).toBe(true);
    expect(f.select).toHaveBeenCalledWith("families(name)");
    expect(f.insert).not.toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
    expect(f.upsert).not.toHaveBeenCalled();
  });

  it("missing family falls back", async () => {
    for (const result of [
      { data: null, error: null },
      { data: { families: { name: "" } }, error: null },
      { data: null, error: new Error("rls") },
    ]) {
      expect(await getFamilyName(fakeClient(result).client)).toBe("My family");
    }
  });
});
