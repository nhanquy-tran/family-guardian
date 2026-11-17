import { afterEach, describe, expect, it, vi } from "vitest";
import { hmacSha256Hex } from "../../../../lib/pairing/pair-device";

const rpc = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/supabase/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/supabase/admin")>()),
  createAdminClient: () => ({ rpc }),
}));

function request(body: unknown, headers: Record<string, string> = { "x-forwarded-for": "203.0.113.5, 10.0.0.1" }) {
  return new Request("http://localhost/api/device/pair", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const VALID = { code: "AB2CD3", browser: "chrome", os: "Windows" };

function stubRpc() {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) =>
    fn === "register_pair_attempt" ? { data: 1, error: null } : { data: "device-1", error: null },
  );
}

afterEach(() => vi.unstubAllEnvs());

describe("pair route", () => {
  it("clientIp is used for the limiter", async () => {
    vi.stubEnv("PAIR_RATE_LIMIT_SECRET", "test-secret");
    stubRpc();
    const { POST } = await import("./route");
    const res = await POST(request(VALID));
    const attempts = rpc.mock.calls.filter((c) => c[0] === "register_pair_attempt");
    expect(attempts).toHaveLength(1);
    expect(JSON.stringify(attempts[0][1])).toContain(hmacSha256Hex("test-secret", "203.0.113.5"));
    expect(res.status).toBe(200);
    expect((await res.json()).deviceToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("HMAC secret missing", async () => {
    stubRpc();
    const { POST } = await import("./route");
    for (const value of [undefined, ""]) {
      if (value === undefined) delete process.env.PAIR_RATE_LIMIT_SECRET;
      else vi.stubEnv("PAIR_RATE_LIMIT_SECRET", value);
      const res = await POST(request(VALID));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "server_error" });
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});
