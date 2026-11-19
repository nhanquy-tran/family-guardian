import { CATEGORIES } from "@fg/shared";
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

import { addCategoryAction, addDomainAction, removeRuleAction, saveAllowedHoursAction, saveLimitsAction } from "./actions";

const PATH = "/dashboard/children/child-1/rules";

beforeEach(() => {
  state.revalidatePath.mockReset();
  state.fake = fakeSupabase();
});

describe("addDomainAction", () => {
  it("inserts the normalised domain for the given child", async () => {
    expect(await redirectOf(() => addDomainAction(form({ childId: "child-1", domain: "https://www.YouTube.com/watch" })))).toBe(PATH);
    expect(state.fake.writes()).toEqual([
      { table: "block_rules", ops: [["insert", [{ child_id: "child-1", kind: "domain", value: "youtube.com" }]]] },
    ]);
    expect(state.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("rejects an invalid domain before the database", async () => {
    for (const domain of ["", "localhost", "192.168.1.1"]) {
      expect(await redirectOf(() => addDomainAction(form({ childId: "child-1", domain })))).toBe(`${PATH}?error=invalid_domain`);
    }
    expect(state.fake.calls).toHaveLength(0);
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a duplicate rule and other database errors", async () => {
    state.fake = fakeSupabase(byTable({ block_rules: { error: { code: "23505", message: "duplicate" } } }));
    expect(await redirectOf(() => addDomainAction(form({ childId: "child-1", domain: "youtube.com" })))).toBe(`${PATH}?error=duplicate`);
    state.fake = fakeSupabase(byTable({ block_rules: { error: DB_ERROR } }));
    expect(await redirectOf(() => addDomainAction(form({ childId: "child-1", domain: "youtube.com" })))).toBe(`${PATH}?error=failed`);
  });

  it("without a session the insert is refused", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(await redirectOf(() => addDomainAction(form({ childId: "child-1", domain: "youtube.com" })))).toBe(`${PATH}?error=failed`);
  });

  it("encodes the child id in the return path", async () => {
    expect(await redirectOf(() => addDomainAction(form({ childId: "a/b?c", domain: "x" })))).toBe(
      "/dashboard/children/a%2Fb%3Fc/rules?error=invalid_domain",
    );
  });
});

describe("addCategoryAction", () => {
  it("inserts a category rule for the given child", async () => {
    expect(await redirectOf(() => addCategoryAction(form({ childId: "child-1", category: "games" })))).toBe(PATH);
    expect(state.fake.writes()).toEqual([
      { table: "block_rules", ops: [["insert", [{ child_id: "child-1", kind: "category", value: "games" }]]] },
    ]);
  });

  it("rejects an unknown or missing category", async () => {
    for (const data of [form({ childId: "child-1", category: "music" }), form({ childId: "child-1" })]) {
      expect(await redirectOf(() => addCategoryAction(data))).toBe(`${PATH}?error=invalid_category`);
    }
    expect(state.fake.calls).toHaveLength(0);
  });

  it("surfaces a database error", async () => {
    state.fake = fakeSupabase(byTable({ block_rules: { error: DB_ERROR } }));
    expect(await redirectOf(() => addCategoryAction(form({ childId: "child-1", category: "games" })))).toBe(`${PATH}?error=failed`);
  });
});

describe("removeRuleAction", () => {
  it("deletes the rule by id", async () => {
    state.fake = fakeSupabase(byTable({ block_rules: { data: [{ id: "rule-1" }], error: null } }));
    expect(await redirectOf(() => removeRuleAction(form({ childId: "child-1", ruleId: "rule-1" })))).toBe(PATH);
    expect(state.fake.writes()).toEqual([
      { table: "block_rules", ops: [["delete", []], ["eq", ["id", "rule-1"]], ["select", ["id"]]] },
    ]);
  });

  it("reports a rule that is gone or not visible", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(await redirectOf(() => removeRuleAction(form({ childId: "child-1", ruleId: "rule-1" })))).toBe(`${PATH}?error=not_found`);
  });

  it("surfaces a database error", async () => {
    state.fake = fakeSupabase(byTable({ block_rules: { data: null, error: DB_ERROR } }));
    expect(await redirectOf(() => removeRuleAction(form({ childId: "child-1", ruleId: "rule-1" })))).toBe(`${PATH}?error=failed`);
  });
});

describe("saveLimitsAction", () => {
  it("upserts set limits and deletes cleared ones for the given child", async () => {
    expect(await redirectOf(() => saveLimitsAction(form({ childId: "child-1", limit_games: " 60 ", limit_social: "30" })))).toBe(PATH);
    const [upsert, del] = state.fake.writes();
    expect(upsert).toEqual({
      table: "child_category_limits",
      ops: [
        [
          "upsert",
          [
            CATEGORIES.filter((c) => c === "games" || c === "social").map((category) => ({
              child_id: "child-1",
              category,
              minutes_per_day: category === "games" ? 60 : 30,
            })),
            { onConflict: "child_id,category" },
          ],
        ],
      ],
    });
    expect(del).toEqual({
      table: "child_category_limits",
      ops: [
        ["delete", []],
        ["eq", ["child_id", "child-1"]],
        ["in", ["category", CATEGORIES.filter((c) => c !== "games" && c !== "social")]],
      ],
    });
    expect(state.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("rejects minutes outside 5 to 1440 before the database", async () => {
    for (const value of ["4", "1441", "1.5", "abc", "-10"]) {
      expect(await redirectOf(() => saveLimitsAction(form({ childId: "child-1", limit_games: value })))).toBe(
        `${PATH}?limitsError=invalid_minutes`,
      );
    }
    expect(state.fake.calls).toHaveLength(0);
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it("surfaces a database error", async () => {
    state.fake = fakeSupabase(byTable({ child_category_limits: { error: DB_ERROR } }));
    expect(await redirectOf(() => saveLimitsAction(form({ childId: "child-1", limit_games: "60" })))).toBe(
      `${PATH}?limitsError=failed`,
    );
    expect(await redirectOf(() => saveLimitsAction(form({ childId: "child-1" })))).toBe(`${PATH}?limitsError=failed`);
  });

  it("without a session the upsert is refused", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(await redirectOf(() => saveLimitsAction(form({ childId: "child-1", limit_games: "60" })))).toBe(
      `${PATH}?limitsError=failed`,
    );
  });

  it("clearing the limits of a child that RLS hides is reported", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(await redirectOf(() => saveLimitsAction(form({ childId: "child-1" })))).toBe(`${PATH}?limitsError=not_found`);
    expect(state.fake.writes()).toHaveLength(0);
  });
});

describe("saveAllowedHoursAction", () => {
  it("updates the hours of the given child", async () => {
    state.fake = fakeSupabase(byTable({ children: { data: [{ id: "child-1" }], error: null } }));
    expect(
      await redirectOf(() => saveAllowedHoursAction(form({ childId: "child-1", allowed_start: "07:00", allowed_end: "21:00" }))),
    ).toBe(PATH);
    expect(state.fake.writes()).toEqual([
      {
        table: "children",
        ops: [["update", [{ allowed_start: "07:00", allowed_end: "21:00" }]], ["eq", ["id", "child-1"]], ["select", ["id"]]],
      },
    ]);
    expect(state.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("clears the hours when both fields are empty", async () => {
    state.fake = fakeSupabase(byTable({ children: { data: [{ id: "child-1" }], error: null } }));
    expect(await redirectOf(() => saveAllowedHoursAction(form({ childId: "child-1" })))).toBe(PATH);
    expect(state.fake.writes()[0]?.ops[0]).toEqual(["update", [{ allowed_start: null, allowed_end: null }]]);
  });

  it("rejects a half-set or malformed window before the database", async () => {
    for (const [start, end] of [["07:00", ""], ["", "21:00"], ["7:00", "21:00"], ["07:00", "07:00"]]) {
      expect(
        await redirectOf(() => saveAllowedHoursAction(form({ childId: "child-1", allowed_start: start!, allowed_end: end! }))),
      ).toBe(`${PATH}?hoursError=invalid_hours`);
    }
    expect(state.fake.calls).toHaveLength(0);
  });

  it("surfaces a database error", async () => {
    state.fake = fakeSupabase(byTable({ children: { error: DB_ERROR } }));
    expect(
      await redirectOf(() => saveAllowedHoursAction(form({ childId: "child-1", allowed_start: "07:00", allowed_end: "21:00" }))),
    ).toBe(`${PATH}?hoursError=failed`);
  });

  it("reports a child that RLS hides instead of saving", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(
      await redirectOf(() => saveAllowedHoursAction(form({ childId: "child-1", allowed_start: "07:00", allowed_end: "21:00" }))),
    ).toBe(`${PATH}?hoursError=not_found`);
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });
});
