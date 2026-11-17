import { UsageEntry } from "@fg/shared";

const MINUTE_MS = 60_000;
const RETENTION_MS = 7 * 24 * 60 * MINUTE_MS;

export function parseQueue(raw: unknown): UsageEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: UsageEntry[] = [];
  for (const item of raw) {
    const parsed = UsageEntry.safeParse(item);
    if (parsed.success) result.push(parsed.data);
  }
  return result;
}

export function pruneQueue(queue: UsageEntry[], now: number): UsageEntry[] {
  const limit = Math.floor(now / MINUTE_MS) * MINUTE_MS - RETENTION_MS;
  return queue.filter((e) => Date.parse(e.minuteUtc) >= limit);
}

function compare(a: UsageEntry, b: UsageEntry): number {
  const byMinute = Date.parse(a.minuteUtc) - Date.parse(b.minuteUtc);
  if (byMinute !== 0) return byMinute;
  return a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0;
}

export function enqueue(queue: UsageEntry[], entries: UsageEntry[], now: number): UsageEntry[] {
  return pruneQueue([...queue, ...entries], now).sort(compare);
}
