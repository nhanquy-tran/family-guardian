import { parseAllowedHours, type AllowedHours } from "@fg/shared";
import type { Dnr, Rule } from "./rules";
import type { KeyValueStore } from "./storage";

export const ALLOWED_HOURS_RULE_ID = 2000000;

const MINUTE_MS = 60_000;
const MAX_SEARCH_MINUTES = 26 * 60;

function parseHours(raw: unknown): AllowedHours | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { start, end } = raw as { start?: unknown; end?: unknown };
  return parseAllowedHours(start, end);
}

const toMinutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function makeFormatter(timezone: string | undefined): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = { hourCycle: "h23", hour: "2-digit", minute: "2-digit" };
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: timezone ?? "UTC" });
  } catch {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });
  }
}

function insideAt(window: AllowedHours, format: Intl.DateTimeFormat, ms: number): boolean {
  const parts = format.formatToParts(ms);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const t = part("hour") * 60 + part("minute");
  const start = toMinutes(window.start);
  const end = toMinutes(window.end);
  return start < end ? t >= start && t < end : t >= start || t < end;
}

export function inAllowedHours(hours: unknown, nowMs: number, timezone?: string): boolean {
  const window = parseHours(hours);
  if (window === null) return true;
  return insideAt(window, makeFormatter(timezone), nowMs);
}

export function nextEdge(hours: unknown, nowMs: number, timezone?: string): number | null {
  const window = parseHours(hours);
  if (window === null) return null;
  const format = makeFormatter(timezone);
  const current = insideAt(window, format, nowMs);
  const first = Math.floor(nowMs / MINUTE_MS) * MINUTE_MS;
  for (let i = 1; i <= MAX_SEARCH_MINUTES; i++) {
    const t = first + i * MINUTE_MS;
    if (insideAt(window, format, t) !== current) return t;
  }
  return null;
}

export function buildHoursRule(start: string): Rule {
  return {
    id: ALLOWED_HOURS_RULE_ID,
    priority: 2,
    action: { type: "redirect", redirect: { extensionPath: `/blocked.html?h=${start}` } },
    condition: { regexFilter: "^https?://", resourceTypes: ["main_frame"] },
  };
}

export interface ReconcileDeps {
  store: KeyValueStore;
  dnr: Dnr;
  alarms?: { create(name: string, info: { when: number }): unknown };
  now: number;
}

/** Makes the hours rule match the stored window; never throws, so the next alarm retries. */
export async function reconcileHours(deps: ReconcileDeps): Promise<void> {
  try {
    const hours = parseHours(await deps.store.get("rulesAllowedHours"));
    const timezone = await deps.store.get("rulesTimezone");
    const tz = typeof timezone === "string" ? timezone : undefined;
    if (hours !== null && deps.alarms !== undefined) {
      const edge = nextEdge(hours, deps.now, tz);
      if (edge !== null) deps.alarms.create("hours-edge", { when: edge });
    }
    const paused = hours !== null && !inAllowedHours(hours, deps.now, tz);
    const present = (await deps.dnr.getDynamicRules()).some((r) => r.id === ALLOWED_HOURS_RULE_ID);
    if (paused === present) return;
    await deps.dnr.updateDynamicRules({
      removeRuleIds: paused ? [] : [ALLOWED_HOURS_RULE_ID],
      addRules: paused ? [buildHoursRule(hours.start)] : [],
    });
  } catch {
    return;
  }
}
