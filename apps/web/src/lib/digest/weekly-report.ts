import type { DigestSource } from "./content";
import type { ReportPeriod } from "./schedule";

export type WeeklyReportMessage = { subject: string; text: string; html: string };

/** Total seconds per child id in [start, end); a child without usage may be missing. Rejects on failure. */
export type WeeklyTotals = (childIds: string[], start: string, end: string) => Promise<Record<string, number>>;

export type BuildWeeklyReportInput = {
  familyId: string;
  timezone: string;
  period: ReportPeriod;
  /** Base URL without a trailing slash. */
  appUrl: string;
  source: DigestSource;
  totals: WeeklyTotals;
};

export async function buildWeeklyReport(_input: BuildWeeklyReportInput): Promise<WeeklyReportMessage> {
  throw new Error("not implemented");
}
