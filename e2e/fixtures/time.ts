export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function offsetMs(utcMs: number, timeZone: string): number {
  const parts = formatter(timeZone).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

export type LocalDate = { year: number; month: number; day: number };

export function localDate(utcMs: number, timeZone: string): LocalDate {
  const local = new Date(utcMs + offsetMs(utcMs, timeZone));
  return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() };
}

/** UTC instant of a wall-clock time in the zone (second pass settles DST edges). */
export function zonedToUtc(date: LocalDate, hour: number, minute: number, timeZone: string): number {
  const guess = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const first = guess - offsetMs(guess, timeZone);
  return guess - offsetMs(first, timeZone);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function isWeekend(date: LocalDate): boolean {
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function localMinuteOfDay(utcMs: number, timeZone: string): number {
  const local = utcMs + offsetMs(utcMs, timeZone);
  return Math.floor((((local % DAY) + DAY) % DAY) / MINUTE);
}

export function dateKey(date: LocalDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}
