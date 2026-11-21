import {
  type BlockedAttempt,
  HeartbeatRequest,
  HeartbeatResponse,
  MAX_HEARTBEAT_ENTRIES,
  type OtherUsage,
} from "@fg/shared";
import { parseOtherUsage } from "./limits";
import { parseBlockedQueue, pruneBlocked } from "./blocked";
import type { BrowserName } from "./browser-info";
import { parseQueue, pruneQueue } from "./queue";
import type { KeyValueStore, Post } from "./storage";

export interface FlushDeps {
  now: number;
  token: string;
  baseUrl: string;
  browser: BrowserName;
  extensionVersion: string;
  currentDomain: string | null;
  keepAliveOnly: boolean;
  siteAccess?: boolean;
  store: KeyValueStore;
  post: Post;
}

export type FlushResult =
  | { kind: "ok"; rulesVersion: number; otherUsage?: OtherUsage }
  | { kind: "failed" }
  | { kind: "unauthorized" };

type SendOutcome = FlushResult | { kind: "too_many" };

async function send(
  deps: FlushDeps,
  entries: HeartbeatRequest["entries"],
  blocked: BlockedAttempt[] = [],
): Promise<SendOutcome> {
  try {
    const body = JSON.stringify(
      HeartbeatRequest.parse({
        entries,
        currentDomain: deps.currentDomain,
        browser: deps.browser,
        extensionVersion: deps.extensionVersion,
        ...(blocked.length > 0 ? { blocked } : {}),
        ...(deps.siteAccess === undefined ? {} : { siteAccess: deps.siteAccess }),
      }),
    );
    const response = await deps.post(`${deps.baseUrl}/api/device/heartbeat`, {
      headers: { Authorization: `Bearer ${deps.token}`, "Content-Type": "application/json" },
      body,
    });
    if (response.status === 401) return { kind: "unauthorized" };
    if (response.status === 413) return { kind: "too_many" };
    if (response.status !== 200) return { kind: "failed" };
    const raw: unknown = await response.json();
    const parsed = HeartbeatResponse.safeParse(raw);
    if (!parsed.success) return { kind: "failed" };
    const otherUsage = parseOtherUsage(raw);
    return { kind: "ok", rulesVersion: parsed.data.rulesVersion, ...(otherUsage ? { otherUsage } : {}) };
  } catch {
    return { kind: "failed" };
  }
}

export async function flushQueue(deps: FlushDeps): Promise<FlushResult> {
  let queue: ReturnType<typeof parseQueue>;
  let blocked: BlockedAttempt[] = [];
  try {
    queue = pruneQueue(parseQueue(await deps.store.get("queue")), deps.now);
    if (!deps.keepAliveOnly) {
      blocked = pruneBlocked(parseBlockedQueue(await deps.store.get("blockedQueue")), deps.now);
    }
  } catch {
    return { kind: "failed" };
  }

  // Sent only with the first request; cleared after its 200.
  async function clearBlocked(): Promise<boolean> {
    if (blocked.length === 0) return true;
    try {
      const current = pruneBlocked(parseBlockedQueue(await deps.store.get("blockedQueue")), deps.now);
      await deps.store.set("blockedQueue", current.slice(blocked.length));
      blocked = [];
      return true;
    } catch {
      return false;
    }
  }

  if (deps.keepAliveOnly || queue.length === 0) {
    const outcome = await send(deps, [], blocked);
    if (outcome.kind === "too_many") return { kind: "failed" };
    if (outcome.kind === "ok" && !(await clearBlocked())) return { kind: "failed" };
    return outcome;
  }

  let size = MAX_HEARTBEAT_ENTRIES;
  let last: FlushResult = { kind: "failed" };
  while (queue.length > 0) {
    const chunk = queue.slice(0, Math.min(size, queue.length));
    const outcome = await send(deps, chunk, blocked);
    if (outcome.kind === "too_many") {
      size = Math.floor(chunk.length / 2);
      if (size === 0) return { kind: "failed" };
      continue;
    }
    if (outcome.kind !== "ok") return outcome;
    queue = queue.slice(chunk.length);
    try {
      await deps.store.set("queue", queue);
    } catch {
      return { kind: "failed" };
    }
    if (!(await clearBlocked())) return { kind: "failed" };
    last = outcome;
  }
  return last;
}
