import { describe, expect, it, vi } from "vitest";
import { deviceErrorMessage, listDevicesByChild, removeDevice, renameDevice } from "./devices";

type Client = Parameters<typeof listDevicesByChild>[0];

const dev = (id: string, created_at: string) => ({
  id,
  name: null,
  browser: "chrome",
  os: "Windows",
  extension_version: "0.1.0",
  last_seen_at: null,
  created_at,
});

function listClient(result: unknown) {
  const order = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ order });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as Client, from, select, order };
}

function mutationClient(result: unknown) {
  const select = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  const del = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update, delete: del });
  return { client: { from } as unknown as Client, from, update, delete: del, eq };
}

describe("listDevicesByChild", () => {
  it("grouped and ordered", async () => {
    const children = [
      { id: "c1", name: "Lan", devices: [dev("d2", "2026-11-17T09:00:00Z"), dev("d1", "2026-11-16T09:00:00Z")] },
      { id: "c2", name: "Minh", devices: [] },
    ];
    const f = listClient({ data: children, error: null });
    const result = await listDevicesByChild(f.client);
    expect(f.from).toHaveBeenCalledWith("children");
    const selectArg = String(f.select.mock.calls[0]?.[0]);
    expect(selectArg).not.toContain("token_hash");
    expect(f.order).toHaveBeenCalledWith("name");
    expect(result?.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(result?.[0]?.devices.map((d) => d.id)).toEqual(["d1", "d2"]);
  });

  it("query error", async () => {
    const f = listClient({ data: null, error: new Error("boom") });
    expect(await listDevicesByChild(f.client)).toBeNull();
  });
});

describe("renameDevice", () => {
  it("valid rename", async () => {
    const f = mutationClient({ data: [{ id: "d1" }], error: null });
    const result = await renameDevice(f.client, "d1", "  Lan's laptop  ");
    expect(f.from).toHaveBeenCalledWith("devices");
    expect(f.update).toHaveBeenCalledWith({ name: "Lan's laptop" });
    expect(f.eq).toHaveBeenCalledWith("id", "d1");
    expect(result).toEqual({ ok: true });
  });

  it("invalid name", async () => {
    for (const name of ["   ", "x".repeat(41)]) {
      const f = mutationClient({ data: [{ id: "d1" }], error: null });
      expect(await renameDevice(f.client, "d1", name)).toEqual({ ok: false, error: "invalid-name" });
      expect(f.from).not.toHaveBeenCalled();
    }
  });

  it("not found or not allowed", async () => {
    for (const result of [
      { data: [], error: null },
      { data: null, error: new Error("rls") },
    ]) {
      const f = mutationClient(result);
      expect(await renameDevice(f.client, "d9", "Laptop")).toEqual({ ok: false, error: "failed" });
    }
  });
});

describe("removeDevice", () => {
  it("remove succeeds", async () => {
    const f = mutationClient({ data: [{ id: "d1" }], error: null });
    const result = await removeDevice(f.client, "d1");
    expect(f.from).toHaveBeenCalledWith("devices");
    expect(f.delete).toHaveBeenCalledTimes(1);
    expect(f.eq).toHaveBeenCalledWith("id", "d1");
    expect(result).toEqual({ ok: true });
  });

  it("remove fails", async () => {
    for (const result of [
      { data: [], error: null },
      { data: null, error: new Error("rls") },
    ]) {
      const f = mutationClient(result);
      expect(await removeDevice(f.client, "d9")).toEqual({ ok: false, error: "failed" });
    }
  });

  it("confirm removes", async () => {
    const f = mutationClient({ data: [{ id: "d1" }], error: null });
    expect(await removeDevice(f.client, "d1")).toEqual({ ok: true });
    expect(f.delete).toHaveBeenCalledTimes(1);
    expect(f.eq).toHaveBeenCalledTimes(1);
    expect(f.eq).toHaveBeenCalledWith("id", "d1");
  });
});

describe("deviceErrorMessage", () => {
  it("known and unknown codes", () => {
    expect(deviceErrorMessage("invalid-name")).toBe("Name must be 1 to 40 characters.");
    expect(deviceErrorMessage("failed")).toBe("Something went wrong. Please try again.");
    expect(deviceErrorMessage("load")).toBe("Could not load devices. Please reload the page.");
    expect(deviceErrorMessage("nope")).toBeNull();
    expect(deviceErrorMessage("<script>alert(1)</script>")).toBeNull();
    expect(deviceErrorMessage("")).toBeNull();
    expect(deviceErrorMessage(undefined)).toBeNull();
  });
});
