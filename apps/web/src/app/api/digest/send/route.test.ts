import { beforeEach, describe, expect, it, vi } from "vitest";

const handlers = vi.hoisted(() => ({
  digest: vi.fn(),
  report: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("../../../../lib/digest/send", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  handleDigestSend: handlers.digest,
}));
vi.mock("../../../../lib/digest/weekly-report-send", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  handleWeeklyReportSend: handlers.report,
}));

const request = () => new Request("https://app.example.test/api/digest/send", { method: "POST", headers: { authorization: "Bearer s3cret" } });

beforeEach(() => {
  handlers.digest.mockReset();
  handlers.report.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("digest send route module", () => {
  it("Only POST is exported", async () => {
    const mod = (await import("./route")) as Record<string, unknown>;
    expect(typeof mod.POST).toBe("function");
    for (const method of ["GET", "PUT", "PATCH", "DELETE"]) {
      expect(mod[method], method).toBeUndefined();
    }
    // the function must outlive the digest and the report running back to back
    expect(typeof mod.maxDuration).toBe("number");
    expect(mod.maxDuration as number).toBeGreaterThan(10);
  });

  it("Route runs both", async () => {
    const counts = { sent: 2, skipped: 1, failed: 0 };
    handlers.digest.mockResolvedValue({ status: 200, body: counts });
    handlers.report.mockResolvedValue({ status: 200, body: { sent: 9, skipped: 9, failed: 9 } });
    const { POST } = await import("./route");

    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(counts);
    expect(handlers.digest).toHaveBeenCalledTimes(1);
    expect(handlers.report).toHaveBeenCalledTimes(1);
    expect(handlers.report.mock.calls[0]?.[0]).toMatchObject({ authorization: "Bearer s3cret" });

    // a failing report never changes the digest response
    handlers.report.mockResolvedValue({ status: 500, body: { error: "server_error" } });
    const failing = await POST(request());
    expect(failing.status).toBe(200);
    expect(await failing.json()).toEqual(counts);
  });

  it("Digest failure stops the report", async () => {
    const { POST } = await import("./route");
    for (const [status, body] of [
      [500, { error: "server_error" }],
      [401, { error: "unauthorized" }],
    ] as const) {
      handlers.digest.mockReset();
      handlers.report.mockReset();
      handlers.digest.mockResolvedValue({ status, body });
      const res = await POST(request());
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual(body);
      expect(handlers.report).not.toHaveBeenCalled();
    }
  });
});
