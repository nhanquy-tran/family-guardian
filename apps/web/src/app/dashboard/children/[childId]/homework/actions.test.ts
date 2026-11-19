import { beforeEach, describe, expect, it, vi } from "vitest";
import { anonymous, byTable, DB_ERROR, fakeSupabase } from "../../../../../lib/testing/fake-supabase";
import { form, redirectOf } from "../../../../../lib/testing/navigation";

const state = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", async () => (await import("../../../../../lib/testing/navigation")).navigation);
vi.mock("next/cache", () => ({ revalidatePath: state.revalidatePath }));
vi.mock("../../../../../lib/supabase/server", () => ({ createClient: async () => state.fake.client }));

import { addDomainAction, removeDomainAction, saveCategoriesAction } from "./actions";

const PATH = "/dashboard/children/child-1/homework";
const updated = { data: [{ id: "child-1" }], error: null };
const current = (domains: string[]) => ({ data: { homework_domains: domains }, error: null });

beforeEach(() => {
  state.revalidatePath.mockReset();
  state.fake = fakeSupabase(byTable({ children: updated }));
});

describe("saveCategoriesAction", () => {
  it("saves the de-duplicated categories on the given child", async () => {
    expect(await redirectOf(() => saveCategoriesAction(form({ childId: "child-1", category: ["education", "news", "education"] })))).toBe(PATH);
    expect(state.fake.writes()).toEqual([
      {
        table: "children",
        ops: [["update", [{ homework_categories: ["education", "news"] }]], ["eq", ["id", "child-1"]], ["select", ["id"]]],
      },
    ]);
    expect(state.revalidatePath).toHaveBeenCalledWith(PATH);
    expect(state.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("rejects an unknown category before the database", async () => {
    expect(await redirectOf(() => saveCategoriesAction(form({ childId: "child-1", category: ["education", "homework"] })))).toBe(
      `${PATH}?error=invalid_category`,
    );
    expect(state.fake.calls).toHaveLength(0);
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it("surfaces a database error", async () => {
    state.fake = fakeSupabase(byTable({ children: { data: null, error: DB_ERROR } }));
    expect(await redirectOf(() => saveCategoriesAction(form({ childId: "child-1", category: "education" })))).toBe(`${PATH}?error=failed`);
  });

  it("without a session no child matches", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(await redirectOf(() => saveCategoriesAction(form({ childId: "child-1", category: "education" })))).toBe(
      `${PATH}?error=not_found`,
    );
  });
});

describe("addDomainAction", () => {
  it("appends the normalised domain to the given child's list", async () => {
    state.fake = fakeSupabase(byTable({ children: [current(["school.org"]), updated] }));
    expect(await redirectOf(() => addDomainAction(form({ childId: "child-1", domain: "WWW.Khan.org/path" })))).toBe(PATH);
    expect(state.fake.calls[0]?.ops).toEqual([["select", ["homework_domains"]], ["eq", ["id", "child-1"]], ["maybeSingle", []]]);
    expect(state.fake.writes()).toEqual([
      {
        table: "children",
        ops: [["update", [{ homework_domains: ["school.org", "khan.org"] }]], ["eq", ["id", "child-1"]], ["select", ["id"]]],
      },
    ]);
  });

  it("rejects invalid, duplicate and excess domains", async () => {
    expect(await redirectOf(() => addDomainAction(form({ childId: "child-1", domain: "not a domain" })))).toBe(`${PATH}?error=invalid_domain`);
    expect(state.fake.calls).toHaveLength(0);

    state.fake = fakeSupabase(byTable({ children: current(["khan.org"]) }));
    expect(await redirectOf(() => addDomainAction(form({ childId: "child-1", domain: "khan.org" })))).toBe(`${PATH}?error=duplicate`);

    const full = Array.from({ length: 50 }, (_, i) => `site${i}.org`);
    state.fake = fakeSupabase(byTable({ children: current(full) }));
    expect(await redirectOf(() => addDomainAction(form({ childId: "child-1", domain: "khan.org" })))).toBe(`${PATH}?error=too_many`);
    expect(state.fake.writes()).toHaveLength(0);
  });

  it("surfaces a database error on read or write", async () => {
    state.fake = fakeSupabase(byTable({ children: { data: null, error: DB_ERROR } }));
    expect(await redirectOf(() => addDomainAction(form({ childId: "child-1", domain: "khan.org" })))).toBe(`${PATH}?error=failed`);

    state.fake = fakeSupabase(byTable({ children: [current([]), { data: null, error: DB_ERROR }] }));
    expect(await redirectOf(() => addDomainAction(form({ childId: "child-1", domain: "khan.org" })))).toBe(`${PATH}?error=failed`);

    state.fake = fakeSupabase(() => {
      throw new Error("network down");
    });
    expect(await redirectOf(() => addDomainAction(form({ childId: "child-1", domain: "khan.org" })))).toBe(`${PATH}?error=failed`);
  });

  it("without a session nothing is written", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(await redirectOf(() => addDomainAction(form({ childId: "child-1", domain: "khan.org" })))).toBe(`${PATH}?error=failed`);
    expect(state.fake.writes()).toHaveLength(0);
  });
});

describe("removeDomainAction", () => {
  it("removes the domain from the given child's list", async () => {
    state.fake = fakeSupabase(byTable({ children: [current(["school.org", "khan.org"]), updated] }));
    expect(await redirectOf(() => removeDomainAction(form({ childId: "child-1", domain: "khan.org" })))).toBe(PATH);
    expect(state.fake.writes()[0]?.ops).toEqual([
      ["update", [{ homework_domains: ["school.org"] }]],
      ["eq", ["id", "child-1"]],
      ["select", ["id"]],
    ]);
  });

  it("surfaces a database error", async () => {
    state.fake = fakeSupabase(byTable({ children: { data: null, error: DB_ERROR } }));
    expect(await redirectOf(() => removeDomainAction(form({ childId: "child-1", domain: "khan.org" })))).toBe(`${PATH}?error=failed`);
    expect(state.fake.writes()).toHaveLength(0);
  });
});
