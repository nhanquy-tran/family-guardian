export type DigestFrequency = "daily" | "weekly";

export type DigestFamily = {
  frequency: DigestFrequency;
  /** Local send hour, 0 to 23. */
  hour: number;
  /** IANA timezone; an invalid value is treated as UTC. */
  timezone: string;
  createdAt: string;
};

export type DuePeriod = {
  frequency: DigestFrequency;
  /** Local date (YYYY-MM-DD) on which the period starts. */
  periodStart: string;
  /** UTC instants as ISO strings; the period is [start, end). */
  start: string;
  end: string;
};

const DAY_MS = 86_400_000;

function formatterFor(timezone: string): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = {
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  };
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: timezone });
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
  }
}

/** The local wall clock at an instant, as a UTC-based timestamp (local fields read as if they were UTC). */
function wallClockMs(formatter: Intl.DateTimeFormat, instantMs: number): number {
  const parts: Record<string, number> = {};
  for (const p of formatter.formatToParts(new Date(instantMs))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return Date.UTC(parts.year ?? 1970, (parts.month ?? 1) - 1, parts.day ?? 1, parts.hour ?? 0, parts.minute ?? 0);
}

/** The UTC instant at which the local clock shows `localMs` (a wall clock read as UTC). */
function localToInstantMs(formatter: Intl.DateTimeFormat, localMs: number): number {
  let guess = localMs - (wallClockMs(formatter, localMs) - localMs);
  guess = localMs - (wallClockMs(formatter, guess) - guess);
  return guess;
}

function isoDate(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

export function latestDuePeriod(family: DigestFamily, now: Date): DuePeriod | null {
  const formatter = formatterFor(family.timezone);
  const local = wallClockMs(formatter, now.getTime());
  let sendDay = Math.floor(local / DAY_MS);
  if (local - sendDay * DAY_MS < family.hour * 3_600_000) sendDay -= 1;
  if (family.frequency === "weekly") {
    const weekday = new Date(sendDay * DAY_MS).getUTCDay();
    sendDay -= (weekday + 6) % 7;
  }

  const sendMoment = localToInstantMs(formatter, sendDay * DAY_MS + family.hour * 3_600_000);
  if (Date.parse(family.createdAt) > sendMoment) return null;

  const startDay = sendDay - (family.frequency === "weekly" ? 7 : 1);
  return {
    frequency: family.frequency,
    periodStart: isoDate(startDay),
    start: new Date(localToInstantMs(formatter, startDay * DAY_MS)).toISOString(),
    end: new Date(localToInstantMs(formatter, sendDay * DAY_MS)).toISOString(),
  };
}

export type ReportPeriod = {
  frequency: "weekly_report";
  /** Local date (YYYY-MM-DD) of the Monday on which the reported week starts. */
  periodStart: string;
  /** UTC instants as ISO strings; the week is [start, end). */
  start: string;
  end: string;
  /** Start of the week before, as an ISO string. */
  prevStart: string;
};

export function reportPeriod(family: DigestFamily, now: Date): ReportPeriod | null {
  const due = latestDuePeriod({ ...family, frequency: "weekly" }, now);
  if (!due) return null;
  const startDay = Date.parse(`${due.periodStart}T00:00:00Z`) / DAY_MS;
  return {
    frequency: "weekly_report",
    periodStart: due.periodStart,
    start: due.start,
    end: due.end,
    prevStart: new Date(localToInstantMs(formatterFor(family.timezone), (startDay - 7) * DAY_MS)).toISOString(),
  };
}
