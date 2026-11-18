import { CATEGORIES, categorize, type Category } from "./categories";

export type DayEntry = { day: string; domain: string; seconds: number };
export type MinuteEntry = { minuteUtc: string; domain: string; seconds: number };
export type SiteSummary = { domain: string; seconds: number; share: number };
export type DaySummary = {
  totalSeconds: number;
  topSites: SiteSummary[];
  byCategory: Record<Category, number>;
};
export type WeekDay = { day: string; totalSeconds: number; byCategory: Record<Category, number> };
export type WeekSummary = { days: WeekDay[]; topSites: SiteSummary[] };
/** A minute with usage: an absolute instant, or a minute of the local day (as returned by SQL). */
export type TimelineRow =
  | { minuteUtc: string; domains: string[]; seconds: number[] }
  | { minuteOfDay: number; domains: string[]; seconds: number[] };
export type TimelineSlot = { minuteOfDay: number; category: Category };

const DAY_MS = 86_400_000;

function emptyCategories(): Record<Category, number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
}

function partsIn(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

function offsetMs(ms: number, tz: string): number {
  const p = partsIn(ms, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000;
}

function startOfLocalDayMs(day: string, tz: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const wall = Date.UTC(y, m - 1, d);
  const first = wall - offsetMs(wall, tz);
  return wall - offsetMs(first, tz);
}

function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export function dayRangeUtc(day: string, tz: string): { startUtc: string; endUtc: string } {
  return {
    startUtc: new Date(startOfLocalDayMs(day, tz)).toISOString(),
    endUtc: new Date(startOfLocalDayMs(addDays(day, 1), tz)).toISOString(),
  };
}

export function localDay(minuteUtc: string, tz: string): string {
  const p = partsIn(Date.parse(minuteUtc), tz);
  return `${String(p.y).padStart(4, "0")}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

function topSites(totals: Map<string, number>, total: number): SiteSummary[] {
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([domain, seconds]) => ({ domain, seconds, share: total > 0 ? Math.round((seconds / total) * 100) : 0 }));
}

type Overrides = Readonly<Record<string, Category>>;

export function summarizeDay(entries: { domain: string; seconds: number }[], overrides?: Overrides): DaySummary {
  const totals = new Map<string, number>();
  const byCategory = emptyCategories();
  let totalSeconds = 0;
  for (const e of entries) {
    totals.set(e.domain, (totals.get(e.domain) ?? 0) + e.seconds);
    byCategory[categorize(e.domain, overrides)] += e.seconds;
    totalSeconds += e.seconds;
  }
  return { totalSeconds, topSites: topSites(totals, totalSeconds), byCategory };
}

export function summarizeWeek(entries: (DayEntry | MinuteEntry)[], tz: string, lastDay: string, overrides?: Overrides): WeekSummary {
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => ({
    day: addDays(lastDay, i - 6),
    totalSeconds: 0,
    byCategory: emptyCategories(),
  }));
  const index = new Map(days.map((d) => [d.day, d]));
  const totals = new Map<string, number>();
  let total = 0;
  for (const e of entries) {
    const day = index.get("day" in e ? e.day : localDay(e.minuteUtc, tz));
    if (!day) continue;
    day.totalSeconds += e.seconds;
    day.byCategory[categorize(e.domain, overrides)] += e.seconds;
    totals.set(e.domain, (totals.get(e.domain) ?? 0) + e.seconds);
    total += e.seconds;
  }
  return { days, topSites: topSites(totals, total) };
}

export function buildTimeline(rows: TimelineRow[], tz: string, day: string, overrides?: Overrides): TimelineSlot[] {
  const slots: TimelineSlot[] = [];
  for (const row of rows) {
    let minuteOfDay: number;
    if ("minuteOfDay" in row) {
      minuteOfDay = row.minuteOfDay;
    } else {
      if (localDay(row.minuteUtc, tz) !== day) continue;
      const p = partsIn(Date.parse(row.minuteUtc), tz);
      minuteOfDay = p.h * 60 + p.min;
    }
    const sums = emptyCategories();
    row.domains.forEach((domain, i) => {
      sums[categorize(domain, overrides)] += row.seconds[i] ?? 0;
    });
    let best: Category = CATEGORIES[0];
    for (const c of CATEGORIES) if (sums[c] > sums[best]) best = c;
    slots.push({ minuteOfDay, category: best });
  }
  return slots.sort((a, b) => a.minuteOfDay - b.minuteOfDay);
}

export function resolveTimezone(value: string | null | undefined): string {
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}
