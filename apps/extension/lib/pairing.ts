import { normalizePairingCode, PairRequest, PairResponse } from "@fg/shared";
import type { BrowserName } from "./browser-info";
import type { KeyValueStore, Post } from "./storage";

export type PairFailure = "invalid_code" | "rate_limited" | "failed";
export type PairResult = { ok: true } | { ok: false; reason: PairFailure };
export type ConnectionStatus = "connected" | "rejected" | "not_connected";

export interface PairDeps {
  baseUrl: string;
  browser: BrowserName;
  os: string;
  store: KeyValueStore;
  post: Post;
}

export const PAIR_MESSAGES: Record<PairFailure | "misconfigured", string> = {
  invalid_code: "This code is not valid or has expired. Ask your parent for a new code.",
  rate_limited: "Too many attempts. Please wait 10 minutes and try again.",
  failed: "Could not connect. Check the internet connection and try again.",
  misconfigured: "This extension is not set up correctly. Ask your parent to reinstall it.",
};

export const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connected: "Connected.",
  rejected: "Disconnected. Ask your parent to pair this browser again.",
  not_connected: "Not connected.",
};

const fail = (reason: PairFailure): PairResult => ({ ok: false, reason });

export async function pairWithCode(deps: PairDeps, rawCode: string): Promise<PairResult> {
  const code = normalizePairingCode(rawCode);
  if (code === null) return fail("invalid_code");
  try {
    const response = await deps.post(`${deps.baseUrl}/api/device/pair`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(PairRequest.parse({ code, browser: deps.browser, os: deps.os })),
    });
    if (response.status === 429) return fail("rate_limited");
    if (response.status === 400) {
      const body = (await response.json()) as { error?: unknown } | null;
      return fail(body?.error === "invalid_code" ? "invalid_code" : "failed");
    }
    if (response.status !== 200) return fail("failed");
    const parsed = PairResponse.safeParse(await response.json());
    if (!parsed.success) return fail("failed");
    await deps.store.remove(["queue", "trackerState", "authState", "rulesVersion", "blockedQueue", "rulesLimits", "rulesTimezone", "rulesOverrides", "limitUsage", "limitBlocked", "rulesAllowedHours", "otherUsage"]);
    await deps.store.set("browser", deps.browser);
    await deps.store.set("deviceToken", parsed.data.deviceToken);
    return { ok: true };
  } catch {
    return fail("failed");
  }
}

export async function readToken(store: KeyValueStore): Promise<string | null> {
  const token = await store.get("deviceToken");
  return typeof token === "string" && token.length > 0 ? token : null;
}

export async function connectionStatus(store: KeyValueStore): Promise<ConnectionStatus> {
  try {
    if ((await readToken(store)) === null) return "not_connected";
    return (await store.get("authState")) === "rejected" ? "rejected" : "connected";
  } catch {
    return "not_connected";
  }
}
