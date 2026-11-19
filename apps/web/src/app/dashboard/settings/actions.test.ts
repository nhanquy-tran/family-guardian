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

import { captureTimezoneAction, saveDigestSettingsAction, saveWeeklyReportAction } from "./actions";

const PATH = "/dashboard/settings";
const matched = { data: [{ id: "fam-1" }], error: null };
const digest = (overrides: Record<string, string> = {}) =>
  form({ frequency: "weekly", hour: "7", timezone: "Europe/Zurich", ...overrides });

beforeEach(() => {
  state.revalidatePath.mockReset();
  state.fake = fakeSupabase(byTable({ families: matched }));
});

describe("saveDigestSettingsAction", () => {
  it("updates the caller's family row, scoped by RLS", async () => {
    expect(await redirectOf(() => saveDigestSettingsAction(digest()))).toBe(`${PATH}?saved=1`);
    expect(state.fake.writes()).toEqual([
      {
        table: "families",
        ops: [
          ["update", [{ digest_frequency: "weekly", digest_hour: 7, timezone: "Europe/Zurich", timezone_known: true }]],
          ["select", ["id"]],
        ],
      },
    ]);
    expect(state.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("rejects each invalid field before the database", async () => {
    const invalid = [
      digest({ frequency: "monthly" }),
      digest({ hour: "" }),
      digest({ hour: "7.5" }),
      digest({ hour: "-1" }),
      digest({ hour: "24" }),
      digest({ timezone: "" }),
      digest({ timezone: "Mars/Olympus" }),
      form({}),
    ];
    for (const data of invalid) {
      expect(await redirectOf(() => saveDigestSettingsAction(data))).toBe(`${PATH}?error=invalid`);
    }
    expect(state.fake.calls).toHaveLength(0);
  });

  it("surfaces a database error", async () => {
    state.fake = fakeSupabase(byTable({ families: { data: null, error: DB_ERROR } }));
    expect(await redirectOf(() => saveDigestSettingsAction(digest()))).toBe(`${PATH}?error=failed`);
  });

  it("without a session no family matches", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(await redirectOf(() => saveDigestSettingsAction(digest()))).toBe(`${PATH}?error=failed`);
  });
});

describe("saveWeeklyReportAction", () => {
  it("saves the checkbox state on the caller's family", async () => {
    expect(await redirectOf(() => saveWeeklyReportAction(form({ weekly_report: "on" })))).toBe(`${PATH}?saved=1`);
    expect(await redirectOf(() => saveWeeklyReportAction(form({})))).toBe(`${PATH}?saved=1`);
    expect(state.fake.writes().map((c) => c.ops)).toEqual([
      [["update", [{ weekly_report_enabled: true }]], ["select", ["id"]]],
      [["update", [{ weekly_report_enabled: false }]], ["select", ["id"]]],
    ]);
  });

  it("surfaces a database error", async () => {
    state.fake = fakeSupabase(byTable({ families: { data: null, error: DB_ERROR } }));
    expect(await redirectOf(() => saveWeeklyReportAction(form({ weekly_report: "on" })))).toBe(`${PATH}?error=failed`);
  });

  it("without a session no family matches", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(await redirectOf(() => saveWeeklyReportAction(form({ weekly_report: "on" })))).toBe(`${PATH}?error=failed`);
  });
});

describe("captureTimezoneAction", () => {
  it("stores a valid timezone only while the family's is unknown", async () => {
    await captureTimezoneAction("Asia/Ho_Chi_Minh");
    expect(state.fake.writes()).toEqual([
      {
        table: "families",
        ops: [["update", [{ timezone: "Asia/Ho_Chi_Minh", timezone_known: true }]], ["eq", ["timezone_known", false]]],
      },
    ]);
  });

  it("ignores an invalid timezone", async () => {
    await captureTimezoneAction("Not/AZone");
    await captureTimezoneAction("");
    expect(state.fake.calls).toHaveLength(0);
  });
});
