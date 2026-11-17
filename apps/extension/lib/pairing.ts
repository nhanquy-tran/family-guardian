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
  invalid_code: "",
  rate_limited: "",
  failed: "",
  misconfigured: "",
};

export const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connected: "",
  rejected: "",
  not_connected: "",
};

export async function pairWithCode(_deps: PairDeps, _rawCode: string): Promise<PairResult> {
  throw new Error("not implemented");
}

export async function connectionStatus(_store: KeyValueStore): Promise<ConnectionStatus> {
  throw new Error("not implemented");
}
