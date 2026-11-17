import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

describe("heartbeat route module", () => {
  it("Only POST is exported", async () => {
    const mod = (await import("./route")) as Record<string, unknown>;
    expect(typeof mod.POST).toBe("function");
    for (const method of ["GET", "PUT", "PATCH", "DELETE"]) {
      expect(mod[method], method).toBeUndefined();
    }
  });
});
