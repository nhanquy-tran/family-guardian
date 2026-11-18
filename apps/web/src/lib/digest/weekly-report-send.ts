import { tokenMatches } from "../alerts/offline";
import { reportPeriod } from "./schedule";
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

type Outcome = "sent" | "skipped" | "failed";

async function sendForFamily(input: WeeklyReportInput, family: DigestFamilyRow): Promise<Outcome | null> {
  const period = reportPeriod(family, input.now);
  if (!period) return null;

  const { store } = input;
  if (!(await store.claimDigest(family.id, period.frequency, period.periodStart))) return "skipped";
  try {
    const recipients = await store.listParentEmails(family.id);
    if (recipients.length === 0) return "skipped";
    const message = await input.build(family, period);
    let delivered = false;
    for (const to of recipients) {
      const result = await input.mailer
        .send({ to, subject: message.subject, text: message.text, html: message.html })
        .catch(() => ({ ok: false }));
      if (result.ok) delivered = true;
    }
    if (delivered) return "sent";
  } catch {
    // falls through to release the claim
  }
  await store.releaseDigest(family.id, period.frequency, period.periodStart).catch(() => undefined);
  return "failed";
}

export async function handleWeeklyReportSend(input: WeeklyReportInput): Promise<DigestResult> {
  if (!input.secret) return { status: 500, body: { error: "server_error" } };
  if (!tokenMatches(input.authorization, input.secret)) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  if (!input.mailConfigured || !input.appUrl) return { status: 500, body: { error: "server_error" } };

  let families: DigestFamilyRow[];
  try {
    families = await input.store.listReportFamilies();
  } catch {
    return { status: 500, body: { error: "server_error" } };
  }

  const counts: DigestCounts = { sent: 0, skipped: 0, failed: 0 };
  for (const family of families) {
    let outcome: Outcome | null;
    try {
      outcome = await sendForFamily(input, family);
    } catch {
      outcome = "failed";
    }
    if (outcome) counts[outcome] += 1;
  }
  input.log(counts);
  return { status: 200, body: counts };
}
