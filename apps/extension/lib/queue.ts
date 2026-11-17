import type { UsageEntry } from "@fg/shared";

export function parseQueue(_raw: unknown): UsageEntry[] {
  throw new Error("not implemented");
}

export function pruneQueue(_queue: UsageEntry[], _now: number): UsageEntry[] {
  throw new Error("not implemented");
}

export function enqueue(_queue: UsageEntry[], _entries: UsageEntry[], _now: number): UsageEntry[] {
  throw new Error("not implemented");
}
