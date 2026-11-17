export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export type Post = (
  url: string,
  init: { headers: Record<string, string>; body: string },
) => Promise<{ status: number; json(): Promise<unknown> }>;

export function browserStore(area: {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}): KeyValueStore {
  return {
    async get(key) {
      return (await area.get(key))[key];
    },
    set: (key, value) => area.set({ [key]: value }),
    remove: (keys) => area.remove(keys),
  };
}

export const fetchPost: Post = (url, init) =>
  fetch(url, {
    method: "POST",
    headers: init.headers,
    body: init.body,
    signal: AbortSignal.timeout(30_000),
  });
