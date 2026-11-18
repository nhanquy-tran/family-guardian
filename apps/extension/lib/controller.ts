import type { BrowserName } from "./browser-info";
import { type PairResult, pairWithCode, readToken } from "./pairing";
import { enqueue, parseQueue, pruneQueue } from "./queue";
import { flushQueue } from "./sender";
import { addBlocked, parseBlockedQueue } from "./blocked";
import { addUsage, evaluateLimitBlocks, readOverrides } from "./limits";
import { applyRules, type Dnr, syncRules } from "./rules";
import type { Get, KeyValueStore, Post } from "./storage";
import {
  applyEvent,
  createTracker,
  takeCompletedEntries,
  type TrackerEvent,
  type TrackerState,
} from "./tracker";

export interface ControllerDeps {
  store: KeyValueStore;
  post: Post;
  get?: Get;
  dnr?: Dnr;
  baseUrl: string;
  extensionVersion: string;
  os: string;
  log: (message: string) => void;
}

export interface Controller {
  handleEvent(event: TrackerEvent): Promise<void>;
  onAlarm(now: number): Promise<void>;
  pair(code: string, browser: BrowserName): Promise<PairResult>;
  recordBlocked(domain: string, now: number): Promise<void>;
}

const MINUTE_MS = 60_000;
const REJECTED_RETRY_MINUTES = 15;
const BROWSERS: readonly string[] = ["chrome", "edge", "brave", "other"];
const IDLE_STATES: readonly unknown[] = ["active", "idle", "locked"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTracker(raw: unknown): TrackerState {
  if (
    isObject(raw) &&
    (raw["lastAt"] === null || typeof raw["lastAt"] === "number") &&
    (raw["domain"] === null || typeof raw["domain"] === "string") &&
    typeof raw["focused"] === "boolean" &&
    IDLE_STATES.includes(raw["idle"]) &&
    isObject(raw["minutes"])
  ) {
    return raw as unknown as TrackerState;
  }
  return createTracker();
}

export function createController(deps: ControllerDeps): Controller {
  const { store } = deps;
  let chain: Promise<unknown> = Promise.resolve();

  function serialize<T>(task: () => Promise<T>, fallback: T): Promise<T> {
    const run = chain.then(task).catch((): T => {
      deps.log("Family Guardian: background task failed");
      return fallback;
    });
    chain = run;
    return run;
  }

  async function isRejected(): Promise<boolean> {
    return (await store.get("authState")) === "rejected";
  }

  async function readBrowser(): Promise<BrowserName> {
    const value = await store.get("browser");
    return typeof value === "string" && BROWSERS.includes(value) ? (value as BrowserName) : "other";
  }

  async function loadTracker(): Promise<TrackerState> {
    return parseTracker(await store.get("trackerState"));
  }

  async function alarmWhileRejected(token: string, now: number): Promise<void> {
    const stored = parseQueue(await store.get("queue"));
    const pruned = pruneQueue(stored, now);
    if (pruned.length !== stored.length) await store.set("queue", pruned);
    if (Math.floor(now / MINUTE_MS) % REJECTED_RETRY_MINUTES !== 0) return;
    const result = await flushQueue({
      now,
      token,
      baseUrl: deps.baseUrl,
      browser: await readBrowser(),
      extensionVersion: deps.extensionVersion,
      currentDomain: null,
      keepAliveOnly: true,
      store,
      post: deps.post,
    });
    if (result.kind === "ok") await store.remove(["authState", "trackerState"]);
  }

  async function alarmNormal(token: string, now: number): Promise<void> {
    const ticked = applyEvent(await loadTracker(), { type: "tick", at: now });
    const taken = takeCompletedEntries(ticked, now);
    await store.set("trackerState", taken.state);
    const timezone = await store.get("rulesTimezone");
    const usage = addUsage(
      await store.get("limitUsage"),
      taken.entries,
      now,
      typeof timezone === "string" ? timezone : undefined,
      readOverrides(await store.get("rulesOverrides")),
    );
    await store.set("limitUsage", usage);
    const queue = enqueue(parseQueue(await store.get("queue")), taken.entries, now);
    await store.set("queue", queue);
    const active = taken.state.focused && taken.state.idle === "active";
    const result = await flushQueue({
      now,
      token,
      baseUrl: deps.baseUrl,
      browser: await readBrowser(),
      extensionVersion: deps.extensionVersion,
      currentDomain: active ? taken.state.domain : null,
      keepAliveOnly: false,
      store,
      post: deps.post,
    });
    if (result.kind === "unauthorized") await store.set("authState", "rejected");
    if (result.kind === "ok" && deps.get !== undefined && deps.dnr !== undefined) {
      const stored = await store.get("rulesVersion");
      if (stored !== result.rulesVersion) {
        await syncRules({ baseUrl: deps.baseUrl, token, store, get: deps.get, dnr: deps.dnr, now });
      }
    }
    if (result.kind !== "unauthorized" && deps.dnr !== undefined) await evaluateLimits(deps.dnr, now);
  }

  async function evaluateLimits(dnr: Dnr, now: number): Promise<void> {
    const timezone = await store.get("rulesTimezone");
    const stored = await store.get("rulesDomains");
    const manualDomains = Array.isArray(stored) ? stored.filter((d): d is string => typeof d === "string") : [];
    const blocked = evaluateLimitBlocks({
      limits: await store.get("rulesLimits"),
      usage: await store.get("limitUsage"),
      overrides: await store.get("rulesOverrides"),
      manualDomains,
      now,
      timezone: typeof timezone === "string" ? timezone : undefined,
    });
    const current = readOverrides(await store.get("limitBlocked"));
    if (JSON.stringify(blocked) === JSON.stringify(current)) return;
    await applyRules(dnr, manualDomains, blocked);
    await store.set("limitBlocked", blocked);
  }

  return {
    handleEvent(event) {
      return serialize(async () => {
        if ((await readToken(store)) === null || (await isRejected())) return;
        await store.set("trackerState", applyEvent(await loadTracker(), event));
      }, undefined);
    },
    onAlarm(now) {
      return serialize(async () => {
        const token = await readToken(store);
        if (token === null) return;
        if (await isRejected()) await alarmWhileRejected(token, now);
        else await alarmNormal(token, now);
      }, undefined);
    },
    recordBlocked(domain, now) {
      return serialize(async () => {
        if ((await readToken(store)) === null) return;
        const known = await store.get("rulesDomains");
        const limitBlocked = readOverrides(await store.get("limitBlocked"));
        const manual = Array.isArray(known) && known.includes(domain);
        if (!manual && !Object.hasOwn(limitBlocked, domain)) return;
        const queue = parseBlockedQueue(await store.get("blockedQueue"));
        await store.set("blockedQueue", addBlocked(queue, { at: new Date(now).toISOString(), domain }, now));
      }, undefined);
    },
    pair(code, browser) {
      return serialize(
        () => pairWithCode({ baseUrl: deps.baseUrl, browser, os: deps.os, store, post: deps.post }, code),
        { ok: false, reason: "failed" } satisfies PairResult,
      );
    },
  };
}

export function registerSchedule(api: {
  alarms: { create(name: string, info: { periodInMinutes: number }): unknown };
  idle: { setDetectionInterval(seconds: number): unknown };
}): void {
  api.alarms.create("heartbeat", { periodInMinutes: 1 });
  api.idle.setDetectionInterval(60);
}
