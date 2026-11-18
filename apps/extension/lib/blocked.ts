import { BlockedAttempt, CATEGORIES, MAX_BLOCKED_ATTEMPTS } from "@fg/shared";

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function parseBlockedQueue(raw: unknown): BlockedAttempt[] {
  if (!Array.isArray(raw)) return [];
  const result: BlockedAttempt[] = [];
  for (const item of raw) {
    const parsed = BlockedAttempt.safeParse(item);
    if (parsed.success) result.push(parsed.data);
  }
  return result;
}

export function pruneBlocked(queue: BlockedAttempt[], now: number): BlockedAttempt[] {
  const recent = queue.filter((a) => Date.parse(a.at) >= now - MAX_AGE_MS);
  return recent.slice(-MAX_BLOCKED_ATTEMPTS);
}

export function addBlocked(queue: BlockedAttempt[], attempt: BlockedAttempt, now: number): BlockedAttempt[] {
  return pruneBlocked([...queue, attempt], now);
}

export function describeBlock(search: string): string {
  const category = new URLSearchParams(search).get("c");
  if (category !== null && (CATEGORIES as readonly string[]).includes(category)) {
    return `Daily limit for ${category} reached`;
  }
  return "This site is blocked";
}

export function describeBlockDetail(search: string): string {
  const category = new URLSearchParams(search).get("c");
  if (category !== null && (CATEGORIES as readonly string[]).includes(category)) {
    return "The daily limit for this kind of site is reached. It opens again tomorrow.";
  }
  return "Your parent has blocked this site. Ask them if you need it for school.";
}

export function parseBlockedMessage(raw: unknown): { domain: string } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as { type?: unknown; domain?: unknown };
  if (m.type !== "blocked" || typeof m.domain !== "string") return null;
  return { domain: m.domain };
}
