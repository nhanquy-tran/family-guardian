import type { Dnr, Rule } from "./rules";
import type { Get, KeyValueStore, Post } from "./storage";

export function createStore(
  initial: Record<string, unknown> = {},
  opts: { failGet?: boolean; failSet?: boolean } = {},
) {
  const data = new Map<string, unknown>(Object.entries(initial));
  const ops: string[] = [];
  const store: KeyValueStore = {
    async get(key) {
      if (opts.failGet) throw new Error("get failed");
      return data.get(key);
    },
    async set(key, value) {
      if (opts.failSet) throw new Error("set failed");
      ops.push(`set:${key}`);
      data.set(key, structuredClone(value));
    },
    async remove(keys) {
      for (const key of keys) {
        ops.push(`remove:${key}`);
        data.delete(key);
      }
    },
  };
  return { store, data, ops };
}

export type Reply = { status: number; body?: unknown; nonJson?: boolean } | "network";

export interface Call {
  url: string;
  headers: Record<string, string>;
  raw: string;
  body: Record<string, unknown>;
}

export interface GetCall {
  url: string;
  headers: Record<string, string>;
}

export function createPost(handler: (call: Call, index: number) => Reply | Promise<Reply>) {
  const calls: Call[] = [];
  const post: Post = async (url, init) => {
    const call: Call = { url, headers: init.headers, raw: init.body, body: JSON.parse(init.body) };
    calls.push(call);
    const reply = await handler(call, calls.length - 1);
    if (reply === "network") throw new TypeError("Failed to fetch");
    return {
      status: reply.status,
      json: async () => {
        if (reply.nonJson) throw new SyntaxError("Unexpected token");
        return reply.body;
      },
    };
  };
  return { post, calls };
}

export function createGet(handler: (call: GetCall, index: number) => Reply | Promise<Reply>) {
  const calls: GetCall[] = [];
  const get: Get = async (url, init) => {
    const call: GetCall = { url, headers: init.headers };
    calls.push(call);
    const reply = await handler(call, calls.length - 1);
    if (reply === "network") throw new TypeError("Failed to fetch");
    return {
      status: reply.status,
      json: async () => {
        if (reply.nonJson) throw new SyntaxError("Unexpected token");
        return reply.body;
      },
    };
  };
  return { get, calls };
}

export function createDnr(existingIds: number[] = [], opts: { failUpdate?: boolean } = {}) {
  const updates: { removeRuleIds: number[]; addRules: Rule[] }[] = [];
  let rules: Rule[] = existingIds.map((id) => ({ id }) as unknown as Rule);
  const dnr: Dnr = {
    async getDynamicRules() {
      return rules.map((r) => ({ id: r.id }));
    },
    async updateDynamicRules(options) {
      if (opts.failUpdate) throw new Error("update failed");
      updates.push(structuredClone(options));
      rules = rules.filter((r) => !options.removeRuleIds.includes(r.id)).concat(structuredClone(options.addRules));
    },
  };
  return { dnr, updates, rules: () => rules };
}

export function always(reply: Reply) {
  return createPost(() => reply);
}

export function sequence(replies: Reply[], rest: Reply) {
  return createPost((_call, index) => replies[index] ?? rest);
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export const NOW = Date.parse("2026-11-17T10:05:30Z");
export const at = (time: string, day = "2026-11-17") => Date.parse(`${day}T${time}Z`);
export const entry = (n: number, domain = "example.com") => ({
  minuteUtc: new Date(Date.parse("2026-11-17T00:00:00Z") + n * 60_000).toISOString(),
  domain,
  seconds: 30,
});
export const entries = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => entry(from + i));
