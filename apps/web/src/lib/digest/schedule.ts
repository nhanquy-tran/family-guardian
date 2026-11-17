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

export function latestDuePeriod(_family: DigestFamily, _now: Date): DuePeriod | null {
  throw new Error("not implemented");
}
