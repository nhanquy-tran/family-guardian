import type { ReportPeriod } from "./schedule";
import type { DigestCounts, DigestFamilyRow, DigestResult, DigestStore } from "./send";
import type { WeeklyReportMessage } from "./weekly-report";

export interface ReportStore extends Omit<DigestStore, "listFamilies"> {
  /** Families with weekly_report_enabled. */
  listReportFamilies(): Promise<DigestFamilyRow[]>;
}

export interface ReportMailer {
  send(message: { to: string; subject: string; text: string; html: string }): Promise<{ ok: boolean }>;
}

export type WeeklyReportInput = {
  authorization: string | null;
  secret: string | undefined;
  mailConfigured: boolean;
  appUrl: string | undefined;
  now: Date;
  store: ReportStore;
  mailer: ReportMailer;
  build: (family: DigestFamilyRow, period: ReportPeriod) => Promise<WeeklyReportMessage>;
  log: (counts: DigestCounts) => void;
};

export async function handleWeeklyReportSend(_input: WeeklyReportInput): Promise<DigestResult> {
  throw new Error("not implemented");
}
