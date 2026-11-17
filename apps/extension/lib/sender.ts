import type { BrowserName } from "./browser-info";
import type { KeyValueStore, Post } from "./storage";

export interface FlushDeps {
  now: number;
  token: string;
  baseUrl: string;
  browser: BrowserName;
  extensionVersion: string;
  currentDomain: string | null;
  keepAliveOnly: boolean;
  store: KeyValueStore;
  post: Post;
}

export type FlushResult =
  | { kind: "ok"; rulesVersion: number }
  | { kind: "failed" }
  | { kind: "unauthorized" };

export async function flushQueue(_deps: FlushDeps): Promise<FlushResult> {
  throw new Error("not implemented");
}
