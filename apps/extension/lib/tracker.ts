import { registrableDomain, type UsageEntry } from "@fg/shared";

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
  /** minute start (ms epoch, as string) -> registrable domain -> accumulated ms */
  minutes: Record<string, Record<string, number>>;
}

const MINUTE_MS = 60_000;
const MAX_GAP_MS = 120_000;

export function createTracker(): TrackerState {
  return { lastAt: null, domain: null, focused: false, idle: "active", minutes: {} };
}

function credit(
  minutes: TrackerState["minutes"],
  domain: string,
  from: number,
  to: number,
): TrackerState["minutes"] {
  const next = { ...minutes };
  let cursor = from;
  while (cursor < to) {
    const minuteStart = Math.floor(cursor / MINUTE_MS) * MINUTE_MS;
    const part = Math.min(to, minuteStart + MINUTE_MS) - cursor;
    const key = String(minuteStart);
    const domains = { ...(next[key] ?? {}) };
    const used = Object.values(domains).reduce((n, ms) => n + ms, 0);
    const add = Math.min(part, MINUTE_MS - used);
    if (add > 0) domains[domain] = (domains[domain] ?? 0) + add;
    next[key] = domains;
    cursor += part;
  }
  return next;
}

export function applyEvent(state: TrackerState, event: TrackerEvent): TrackerState {
  let minutes = state.minutes;
  if (state.focused && state.idle === "active" && state.domain !== null && state.lastAt !== null) {
    const gap = event.at - state.lastAt;
    if (gap > 0 && gap <= MAX_GAP_MS) {
      minutes = credit(minutes, state.domain, state.lastAt, event.at);
    }
  }
  const next: TrackerState = { ...state, minutes, lastAt: event.at };
  switch (event.type) {
    case "tab":
      next.domain = event.url === null ? null : registrableDomain(event.url);
      break;
    case "focus":
      next.focused = event.focused;
      break;
    case "idle":
      next.idle = event.state;
      break;
    case "tick":
      break;
  }
  return next;
}

export function takeCompletedEntries(
  state: TrackerState,
  now: number,
): { state: TrackerState; entries: UsageEntry[] } {
  const remaining: TrackerState["minutes"] = {};
  const entries: UsageEntry[] = [];
  const keys = Object.keys(state.minutes).sort((a, b) => Number(a) - Number(b));
  for (const key of keys) {
    const domains = state.minutes[key] ?? {};
    const start = Number(key);
    if (start + MINUTE_MS > now) {
      remaining[key] = domains;
      continue;
    }
    for (const domain of Object.keys(domains).sort()) {
      const seconds = Math.floor((domains[domain] ?? 0) / 1000);
      if (seconds > 0) {
        entries.push({ minuteUtc: new Date(start).toISOString(), domain, seconds });
      }
    }
  }
  return { state: { ...state, minutes: remaining }, entries };
}
