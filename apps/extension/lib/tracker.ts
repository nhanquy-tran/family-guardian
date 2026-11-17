import type { UsageEntry } from "@fg/shared";

export type IdleState = "active" | "idle" | "locked";

export type TrackerEvent =
  | { type: "tab"; at: number; url: string | null }
  | { type: "focus"; at: number; focused: boolean }
  | { type: "idle"; at: number; state: IdleState }
  | { type: "tick"; at: number };

export interface TrackerState {
  lastAt: number | null;
  domain: string | null;
  focused: boolean;
  idle: IdleState;
  minutes: Record<string, Record<string, number>>;
}

export function createTracker(): TrackerState {
  throw new Error("not implemented");
}

export function applyEvent(_state: TrackerState, _event: TrackerEvent): TrackerState {
  throw new Error("not implemented");
}

export function takeCompletedEntries(
  _state: TrackerState,
  _now: number,
): { state: TrackerState; entries: UsageEntry[] } {
  throw new Error("not implemented");
}
