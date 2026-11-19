import { beforeEach, describe, expect, it, vi } from "vitest";
import { anonymous, byTable, DB_ERROR, fakeSupabase } from "../../../lib/testing/fake-supabase";
import { form, redirectOf } from "../../../lib/testing/navigation";

const state = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", async () => (await import("../../../lib/testing/navigation")).navigation);
vi.mock("next/cache", () => ({ revalidatePath: state.revalidatePath }));
vi.mock("../../../lib/supabase/server", () => ({ createClient: async () => state.fake.client }));

import { removeAction, saveAction } from "./actions";

const PATH = "/dashboard/categories";
const parent = { data: { family_id: "fam-1" }, error: null };

beforeEach(() => {
  state.revalidatePath.mockReset();
  state.fake = fakeSupabase(byTable({ parents: parent }));
});

describe("saveAction", () => {
  it("upserts the override for the parent's family", async () => {
    expect(await redirectOf(() => saveAction(form({ domain: "https://www.Roblox.com/games", category: "games" })))).toBe(PATH);
    expect(state.fake.writes()).toEqual([
      {
        table: "domain_categories",
        ops: [["upsert", [{ family_id: "fam-1", domain: "roblox.com", category: "games" }, { onConflict: "family_id,domain" }]]],
      },
    ]);
    expect(state.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("rejects an invalid domain or category before the database", async () => {
    expect(await redirectOf(() => saveAction(form({ domain: "nope", category: "games" })))).toBe(`${PATH}?error=invalid_domain`);
    expect(await redirectOf(() => saveAction(form({ domain: "roblox.com", category: "music" })))).toBe(`${PATH}?error=invalid_category`);
    expect(await redirectOf(() => saveAction(form({ domain: "roblox.com" })))).toBe(`${PATH}?error=invalid_category`);
    expect(state.fake.calls).toHaveLength(0);
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it("surfaces a database error on the family lookup or the upsert", async () => {
    state.fake = fakeSupabase(byTable({ parents: { data: null, error: DB_ERROR } }));
    expect(await redirectOf(() => saveAction(form({ domain: "roblox.com", category: "games" })))).toBe(`${PATH}?error=failed`);
    expect(state.fake.writes()).toHaveLength(0);

    state.fake = fakeSupabase(byTable({ parents: parent, domain_categories: { error: DB_ERROR } }));
    expect(await redirectOf(() => saveAction(form({ domain: "roblox.com", category: "games" })))).toBe(`${PATH}?error=failed`);
  });

  it("without a session nothing is written", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(await redirectOf(() => saveAction(form({ domain: "roblox.com", category: "games" })))).toBe(`${PATH}?error=failed`);
    expect(state.fake.writes()).toHaveLength(0);
  });
});

describe("removeAction", () => {
  it("deletes the override by id", async () => {
    state.fake = fakeSupabase(byTable({ domain_categories: { data: [{ id: "ov-1" }], error: null } }));
    expect(await redirectOf(() => removeAction(form({ id: "ov-1" })))).toBe(PATH);
    expect(state.fake.writes()).toEqual([
      { table: "domain_categories", ops: [["delete", []], ["eq", ["id", "ov-1"]], ["select", ["id"]]] },
    ]);
  });

  it("reports an override that is gone or not visible", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(await redirectOf(() => removeAction(form({ id: "ov-1" })))).toBe(`${PATH}?error=not_found`);
  });

  it("surfaces a database error", async () => {
    state.fake = fakeSupabase(byTable({ domain_categories: { data: null, error: DB_ERROR } }));
    expect(await redirectOf(() => removeAction(form({ id: "ov-1" })))).toBe(`${PATH}?error=failed`);
  });
});
