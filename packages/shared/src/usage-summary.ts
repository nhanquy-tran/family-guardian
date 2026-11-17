import type { Category } from "./categories";

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
export type TimelineRow = { minuteUtc: string; domains: string[]; seconds: number[] };
export type TimelineSlot = { minuteOfDay: number; category: Category };

const notImplemented = (): never => {
  throw new Error("not implemented");
};

export function dayRangeUtc(_day: string, _tz: string): { startUtc: string; endUtc: string } {
  return notImplemented();
}

export function localDay(_minuteUtc: string, _tz: string): string {
  return notImplemented();
}

export function summarizeDay(_entries: { domain: string; seconds: number }[]): DaySummary {
  return notImplemented();
}

export function summarizeWeek(_entries: (DayEntry | MinuteEntry)[], _tz: string, _lastDay: string): WeekSummary {
  return notImplemented();
}

export function buildTimeline(_rows: TimelineRow[], _tz: string, _day: string): TimelineSlot[] {
  return notImplemented();
}

export function resolveTimezone(_value: string | null | undefined): string {
  return notImplemented();
}
