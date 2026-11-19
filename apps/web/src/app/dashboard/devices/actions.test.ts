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

import { removeDeviceAction, renameDeviceAction } from "./actions";

const PATH = "/dashboard/devices";
const matched = { data: [{ id: "dev-1" }], error: null };

beforeEach(() => {
  state.revalidatePath.mockReset();
  state.fake = fakeSupabase(byTable({ devices: matched }));
});

describe("renameDeviceAction", () => {
  it("updates only the name of the given device", async () => {
    expect(await redirectOf(() => renameDeviceAction(form({ deviceId: "dev-1", name: "  Living room " })))).toBe(PATH);
    expect(state.fake.writes()).toEqual([
      { table: "devices", ops: [["update", [{ name: "Living room" }]], ["eq", ["id", "dev-1"]], ["select", ["id"]]] },
    ]);
    expect(state.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("rejects a missing, blank or too long name before the database", async () => {
    for (const data of [form({ deviceId: "dev-1" }), form({ deviceId: "dev-1", name: "  " }), form({ deviceId: "dev-1", name: "x".repeat(41) })]) {
      expect(await redirectOf(() => renameDeviceAction(data))).toBe(`${PATH}?error=invalid-name`);
    }
    expect(state.fake.calls).toHaveLength(0);
  });

  it("ignores a file posted as the name", async () => {
    const data = form({ deviceId: "dev-1" });
    data.append("name", new Blob(["Laptop"]), "name.txt");
    expect(await redirectOf(() => renameDeviceAction(data))).toBe(`${PATH}?error=invalid-name`);
  });

  it("surfaces a database error", async () => {
    state.fake = fakeSupabase(byTable({ devices: { data: null, error: DB_ERROR } }));
    expect(await redirectOf(() => renameDeviceAction(form({ deviceId: "dev-1", name: "Laptop" })))).toBe(`${PATH}?error=failed`);
  });

  it("without a session no device matches", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(await redirectOf(() => renameDeviceAction(form({ deviceId: "dev-1", name: "Laptop" })))).toBe(`${PATH}?error=failed`);
  });
});

describe("removeDeviceAction", () => {
  it("deletes the given device", async () => {
    expect(await redirectOf(() => removeDeviceAction(form({ deviceId: "dev-1" })))).toBe(PATH);
    expect(state.fake.writes()).toEqual([
      { table: "devices", ops: [["delete", []], ["eq", ["id", "dev-1"]], ["select", ["id"]]] },
    ]);
    expect(state.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("surfaces a database error", async () => {
    state.fake = fakeSupabase(byTable({ devices: { data: null, error: DB_ERROR } }));
    expect(await redirectOf(() => removeDeviceAction(form({ deviceId: "dev-1" })))).toBe(`${PATH}?error=failed`);
  });

  it("without a session no device matches", async () => {
    state.fake = fakeSupabase(anonymous, null);
    expect(await redirectOf(() => removeDeviceAction(form({ deviceId: "dev-1" })))).toBe(`${PATH}?error=failed`);
  });
});
