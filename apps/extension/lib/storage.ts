export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export type Post = (
  url: string,
  init: { headers: Record<string, string>; body: string },
) => Promise<{ status: number; json(): Promise<unknown> }>;
