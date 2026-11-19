import { beforeEach, describe, expect, it, vi } from "vitest";
import { anonymous, byTable, DB_ERROR, fakeSupabase, type FakeResult } from "../../../lib/testing/fake-supabase";
import { form, redirectOf } from "../../../lib/testing/navigation";

const state = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", async () => (await import("../../../lib/testing/navigation")).navigation);
vi.mock("next/cache", () => ({ revalidatePath: state.revalidatePath }));
vi.mock("../../../lib/supabase/server", () => ({ createClient: async () => state.fake.client }));

import { addChildAction, createCodeAction, deleteChildAction, renameChildAction } from "./actions";

const PATH = "/dashboard/children";
const NAME_ERROR = `${PATH}?error=${encodeURIComponent("Name must be 1 to 50 characters")}`;
const GENERIC_ERROR = `${PATH}?error=${encodeURIComponent("Something went wrong. Please try again.")}`;

beforeEach(() => {
  state.revalidatePath.mockReset();
  state.fake = fakeSupabase();
});

describe("addChildAction", () => {
  it("inserts the trimmed name into the parent's family and returns to the list", async () => {
    state.fake = fakeSupabase(byTable({ parents: { data: { family_id: "fam-1" }, error: null } }));
    expect(await redirectOf(() => addChildAction(form({ name: "  Minh " })))).toBe(PATH);
    expect(state.fake.writes()).toEqual([{ table: "children", ops: [["insert", [{ family_id: "fam-1", name: "Minh" }]]] }]);
    expect(state.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("rejects a missing, blank or too long name before the database", async () => {
    for (const data of [form({}), form({ name: "   " }), form({ name: "x".repeat(51) })]) {
      expect(await redirectOf(() => addChildAction(data))).toBe(NAME_ERROR);
    }
    expect(state.fake.calls).toHaveLength(0);
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports an account without a family", async () => {
    state.fake = fakeSupabase(byTable({ parents: { data: null, error: null } }));
    expect(await redirectOf(() => addChildAction(form({ name: "Minh" })))).toBe(
      `${PATH}?error=${encodeURIComponent("No family for this account")}`,
    );
    expect(state.fake.writes()).toHaveLength(0);
  });

  it("surfaces database errors without their text", async () => {
    const cases: Record<string, FakeResult>[] = [
      { parents: { data: null, error: DB_ERROR } },
      { parents: { data: { family_id: "fam-1" }, error: null }, children: { error: DB_ERROR } },
    ];
    for (const results of cases) {
      state.fake = fakeSupabase(byTable(results));
      const url = await redirectOf(() => addChildAction(form({ name: "Minh" })));
      expect(url).toBe(GENERIC_ERROR);
      expect(url).not.toContain("secret");
    }
  });

  it("without a session nothing is inserted", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(await redirectOf(() => addChildAction(form({ name: "Minh" })))).toBe(
      `${PATH}?error=${encodeURIComponent("No family for this account")}`,
    );
    expect(state.fake.writes()).toHaveLength(0);
  });
});

describe("renameChildAction", () => {
  it("updates only the name of the given child", async () => {
    expect(await redirectOf(() => renameChildAction(form({ id: "child-1", name: " An " })))).toBe(PATH);
    expect(state.fake.writes()).toEqual([
      { table: "children", ops: [["update", [{ name: "An" }]], ["eq", ["id", "child-1"]]] },
    ]);
    expect(state.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("rejects an invalid name before the database", async () => {
    expect(await redirectOf(() => renameChildAction(form({ id: "child-1", name: "" })))).toBe(NAME_ERROR);
    expect(state.fake.calls).toHaveLength(0);
  });

  it("surfaces a database error", async () => {
    state.fake = fakeSupabase(byTable({ children: { error: DB_ERROR } }));
    expect(await redirectOf(() => renameChildAction(form({ id: "child-1", name: "An" })))).toBe(GENERIC_ERROR);
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteChildAction", () => {
  it("deletes the given child", async () => {
    expect(await redirectOf(() => deleteChildAction(form({ id: "child-1" })))).toBe(PATH);
    expect(state.fake.writes()).toEqual([{ table: "children", ops: [["delete", []], ["eq", ["id", "child-1"]]] }]);
  });

  it("surfaces a database error", async () => {
    state.fake = fakeSupabase(byTable({ children: { error: DB_ERROR } }));
    expect(await redirectOf(() => deleteChildAction(form({ id: "child-1" })))).toBe(GENERIC_ERROR);
  });
});

describe("createCodeAction", () => {
  it("replaces the child's codes with a new one", async () => {
    expect(await redirectOf(() => createCodeAction(form({ childId: "child-1" })))).toBe(PATH);
    const [cleared, inserted] = state.fake.writes();
    expect(cleared).toEqual({ table: "pairing_codes", ops: [["delete", []], ["eq", ["child_id", "child-1"]]] });
    expect(inserted?.table).toBe("pairing_codes");
    const row = inserted?.ops[0]?.[1][0] as { code: string; child_id: string; expires_at: string };
    expect(row.child_id).toBe("child-1");
    expect(row.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(Date.parse(row.expires_at)).toBeGreaterThan(Date.now());
    expect(state.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("reports a failure for the child", async () => {
    state.fake = fakeSupabase(byTable({ pairing_codes: { error: DB_ERROR } }));
    expect(await redirectOf(() => createCodeAction(form({ childId: "child 1" })))).toBe(
      `${PATH}?pairError=child%201&reason=failed`,
    );
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports in-use after repeated collisions", async () => {
    state.fake = fakeSupabase(
      byTable({ pairing_codes: [{ error: null }, { error: { code: "23505", message: "duplicate" } }] }),
    );
    expect(await redirectOf(() => createCodeAction(form({ childId: "child-1" })))).toBe(
      `${PATH}?pairError=child-1&reason=in-use`,
    );
  });

  it("without a session no code is created", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(await redirectOf(() => createCodeAction(form({ childId: "child-1" })))).toBe(
      `${PATH}?pairError=child-1&reason=failed`,
    );
  });
});
