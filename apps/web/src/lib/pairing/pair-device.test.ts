import { describe, expect, it, vi } from "vitest";
import { hashDeviceToken } from "../device/token";
import { clientIp, hmacSha256Hex, pairDevice, type PairDeps } from "./pair-device";

const VALID = { code: " ab2-cd3 ", browser: "chrome", os: "Windows" };
const IP = "203.0.113.5";

function makeDeps(overrides: Partial<PairDeps> = {}) {
  const hashIp = vi.fn((ip: string) => hmacSha256Hex("test-secret", ip));
  const registerAttempt = vi.fn(async (hash: string) => {
    void hash;
    return 1;
  });
  const redeem = vi.fn(async (code: string, tokenHash: string, browser: string, os: string) => {
    void code;
    void tokenHash;
    void browser;
    void os;
    return "device-1" as string | null;
  });
  const deps: PairDeps = { hashIp, registerAttempt, redeem, ...overrides };
  return { deps, hashIp, registerAttempt, redeem };
}

describe("pairDevice", () => {
  it("Successful pairing", async () => {
    const d = makeDeps();
    const res = await pairDevice(d.deps, IP, VALID);
    expect(res.status).toBe(200);
    const token = String(res.body.deviceToken);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(d.redeem).toHaveBeenCalledTimes(1);
    expect(d.redeem).toHaveBeenCalledWith("AB2CD3", hashDeviceToken(token), "chrome", "Windows");
    for (const spy of [d.hashIp, d.registerAttempt, d.redeem]) {
      for (const call of spy.mock.calls) expect(call as unknown[]).not.toContain(token);
    }
  });

  it("Tokens are random", async () => {
    const d = makeDeps();
    const a = await pairDevice(d.deps, IP, VALID);
    const b = await pairDevice(d.deps, IP, VALID);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.deviceToken).not.toBe(b.body.deviceToken);
  });

  it("Same response for every bad code", async () => {
    const d = makeDeps({ redeem: vi.fn(async () => null) });
    const unknown = await pairDevice(d.deps, IP, { code: "ZZZZZZ", browser: "chrome", os: "Windows" });
    const malformed = await pairDevice(d.deps, IP, { code: "AB2CD0", browser: "chrome", os: "Windows" });
    expect(unknown.status).toBe(400);
    expect(malformed.status).toBe(400);
    expect(unknown.body).toEqual({ error: "invalid_code" });
    expect(malformed.body).toEqual({ error: "invalid_code" });
    expect(d.deps.redeem).toHaveBeenCalledTimes(1);
  });

  it("Malformed body", async () => {
    const d = makeDeps();
    for (const body of [{ code: "AB2CD3", browser: "netscape", os: "Windows" }, null]) {
      const res = await pairDevice(d.deps, IP, body);
      expect(res).toEqual({ status: 400, body: { error: "invalid_request" } });
    }
    expect(d.redeem).not.toHaveBeenCalled();
  });

  it("Dependency failure", async () => {
    const d = makeDeps({
      redeem: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    const res = await pairDevice(d.deps, IP, VALID);
    expect(res).toEqual({ status: 500, body: { error: "server_error" } });
    expect(JSON.stringify(res.body)).not.toContain("db down");
  });
});

describe("pairDevice rate limit", () => {
  it("Eleventh attempt is refused", async () => {
    const counts = [10, 11];
    const d = makeDeps({ registerAttempt: vi.fn(async () => counts.shift() ?? 11) });
    const first = await pairDevice(d.deps, IP, VALID);
    const second = await pairDevice(d.deps, IP, VALID);
    expect(first.status).toBe(200);
    expect(second).toEqual({ status: 429, body: { error: "rate_limited" } });
    expect(d.redeem).toHaveBeenCalledTimes(1);
    const hash = vi.mocked(d.deps.registerAttempt).mock.calls[0][0];
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hmacSha256Hex("test-secret", IP));
    expect(hash).not.toBe(IP);
    expect(hash).not.toBe(hashDeviceToken(IP));
  });

  it("Malformed requests count too", async () => {
    const d = makeDeps({ registerAttempt: vi.fn(async () => 11) });
    const res = await pairDevice(d.deps, IP, null);
    expect(res.status).toBe(429);
    expect(d.deps.registerAttempt).toHaveBeenCalledTimes(1);
  });
});

describe("clientIp", () => {
  it("Client IP header", () => {
    const warn = vi.fn();
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }), warn)).toBe("203.0.113.5");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.7" }), warn)).toBe("198.51.100.7");
    expect(warn).not.toHaveBeenCalled();
    expect(clientIp(new Headers(), warn)).toBe("unknown");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("No forwarding headers warns without the IP and is still limited", async () => {
    const warn = vi.fn();
    const d = makeDeps({ registerAttempt: vi.fn(async () => 11) });
    const ip = clientIp(new Headers(), warn);
    const res = await pairDevice(d.deps, ip, VALID);
    expect(d.deps.registerAttempt).toHaveBeenCalledWith(hmacSha256Hex("test-secret", "unknown"));
    expect(res).toEqual({ status: 429, body: { error: "rate_limited" } });
    const text = String(warn.mock.calls[0]?.[0]);
    expect(text).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });
});

describe("pairDevice fails closed", () => {
  it("registerAttempt throws or rejects", async () => {
    const throwing = makeDeps({
      registerAttempt: vi.fn(() => {
        throw new Error("limiter down");
      }),
    });
    const rejecting = makeDeps({ registerAttempt: vi.fn(() => Promise.reject(new Error("limiter down"))) });
    for (const d of [throwing, rejecting]) {
      const res = await pairDevice(d.deps, IP, VALID);
      expect(res).toEqual({ status: 500, body: { error: "server_error" } });
      expect(JSON.stringify(res.body)).not.toContain("limiter down");
      expect(d.redeem).not.toHaveBeenCalled();
    }
  });

  it("hashIp throws", async () => {
    const d = makeDeps({
      hashIp: () => {
        throw new Error("Missing environment variable PAIR_RATE_LIMIT_SECRET");
      },
    });
    const res = await pairDevice(d.deps, IP, VALID);
    expect(res).toEqual({ status: 500, body: { error: "server_error" } });
    expect(d.registerAttempt).not.toHaveBeenCalled();
    expect(d.redeem).not.toHaveBeenCalled();
  });
});
