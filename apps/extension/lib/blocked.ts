import type { BlockedAttempt } from "@fg/shared";

export function parseBlockedQueue(_raw: unknown): BlockedAttempt[] {
  throw new Error("not implemented");
}

export function addBlocked(_queue: BlockedAttempt[], _attempt: BlockedAttempt, _now: number): BlockedAttempt[] {
  throw new Error("not implemented");
}

export function parseBlockedMessage(_raw: unknown): { domain: string } | null {
  throw new Error("not implemented");
}
