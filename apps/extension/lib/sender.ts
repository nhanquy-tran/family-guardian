import { HeartbeatRequest, HeartbeatResponse, MAX_HEARTBEAT_ENTRIES } from "@fg/shared";
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
  store: KeyValueStore;
  post: Post;
}

export type FlushResult =
  | { kind: "ok"; rulesVersion: number }
  | { kind: "failed" }
  | { kind: "unauthorized" };

type SendOutcome = FlushResult | { kind: "too_many" };

async function send(deps: FlushDeps, entries: HeartbeatRequest["entries"]): Promise<SendOutcome> {
  try {
    const body = JSON.stringify(
      HeartbeatRequest.parse({
        entries,
        currentDomain: deps.currentDomain,
        browser: deps.browser,
        extensionVersion: deps.extensionVersion,
      }),
    );
    const response = await deps.post(`${deps.baseUrl}/api/device/heartbeat`, {
      headers: { Authorization: `Bearer ${deps.token}`, "Content-Type": "application/json" },
      body,
    });
    if (response.status === 401) return { kind: "unauthorized" };
    if (response.status === 413) return { kind: "too_many" };
    if (response.status !== 200) return { kind: "failed" };
    const parsed = HeartbeatResponse.safeParse(await response.json());
    return parsed.success ? { kind: "ok", rulesVersion: parsed.data.rulesVersion } : { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
}

export async function flushQueue(deps: FlushDeps): Promise<FlushResult> {
  let queue: ReturnType<typeof parseQueue>;
  try {
    queue = pruneQueue(parseQueue(await deps.store.get("queue")), deps.now);
  } catch {
    return { kind: "failed" };
  }
  if (deps.keepAliveOnly || queue.length === 0) {
    const outcome = await send(deps, []);
    return outcome.kind === "too_many" ? { kind: "failed" } : outcome;
  }

  let size = MAX_HEARTBEAT_ENTRIES;
  let last: FlushResult = { kind: "failed" };
  while (queue.length > 0) {
    const chunk = queue.slice(0, Math.min(size, queue.length));
    const outcome = await send(deps, chunk);
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
    last = outcome;
  }
  return last;
}
