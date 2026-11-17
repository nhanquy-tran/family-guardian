import { createHmac, randomBytes } from "node:crypto";
import { normalizePairingCode, PairRequest } from "@fg/shared";
import { hashDeviceToken } from "../device/token";

export type PairDeps = {
  hashIp: (ip: string) => string;
  registerAttempt: (ipHash: string) => Promise<number> | number;
  redeem: (code: string, tokenHash: string, browser: string, os: string) => Promise<string | null> | string | null;
};
export type PairResult = { status: number; body: Record<string, unknown> };

const MAX_ATTEMPTS = 10;
const SERVER_ERROR: PairResult = { status: 500, body: { error: "server_error" } };
const INVALID_CODE: PairResult = { status: 400, body: { error: "invalid_code" } };

export function hmacSha256Hex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function clientIp(headers: Headers, warn: (message: string) => void): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  warn("pair: no client IP header, using shared bucket");
  return "unknown";
}

export async function pairDevice(deps: PairDeps, ip: string, body: unknown): Promise<PairResult> {
  try {
    const attempts = await deps.registerAttempt(deps.hashIp(ip));
    if (typeof attempts !== "number") return SERVER_ERROR;
    if (attempts > MAX_ATTEMPTS) return { status: 429, body: { error: "rate_limited" } };

    const parsed = PairRequest.safeParse(body);
    if (!parsed.success) return { status: 400, body: { error: "invalid_request" } };
    const code = normalizePairingCode(parsed.data.code);
    if (!code) return INVALID_CODE;

    const token = randomBytes(32).toString("base64url");
    const deviceId = await deps.redeem(code, hashDeviceToken(token), parsed.data.browser, parsed.data.os);
    if (!deviceId) return INVALID_CODE;
    return { status: 200, body: { deviceToken: token } };
  } catch {
    return SERVER_ERROR;
  }
}
