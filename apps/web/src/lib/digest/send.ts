import { tokenMatches } from "../alerts/offline";
import type { DigestMessage } from "./content";
import { latestDuePeriod, type DigestFamily, type DuePeriod } from "./schedule";

export type DigestFamilyRow = DigestFamily & { id: string };

export interface DigestStore {
  listFamilies(): Promise<DigestFamilyRow[]>;
  /** Inserts the (family, frequency, period) key; false if it already exists. */
  claimDigest(familyId: string, frequency: string, periodStart: string): Promise<boolean>;
  /** Deletes that exact key so the next run retries. */
  releaseDigest(familyId: string, frequency: string, periodStart: string): Promise<void>;
  listParentEmails(familyId: string): Promise<string[]>;
}

export interface DigestMailer {
  send(message: { to: string; subject: string; text: string }): Promise<{ ok: boolean }>;
}

export type DigestCounts = { sent: number; skipped: number; failed: number };

export type DigestInput = {
  authorization: string | null;
  secret: string | undefined;
  /** RESEND_API_KEY and ALERT_FROM_EMAIL are both set. */
  mailConfigured: boolean;
  appUrl: string | undefined;
  now: Date;
  store: DigestStore;
  mailer: DigestMailer;
  build: (family: DigestFamilyRow, period: DuePeriod) => Promise<DigestMessage>;
  log: (counts: DigestCounts) => void;
};

export type DigestResult = {
  status: 200 | 401 | 500;
  body: DigestCounts | { error: string };
};

type Outcome = "sent" | "skipped" | "failed";

async function sendForFamily(input: DigestInput, family: DigestFamilyRow): Promise<Outcome | null> {
  const period = latestDuePeriod(family, input.now);
  if (!period) return null;

  const { store } = input;
  if (!(await store.claimDigest(family.id, period.frequency, period.periodStart))) return "skipped";
  try {
    const recipients = await store.listParentEmails(family.id);
    if (recipients.length === 0) return "skipped";
    const message = await input.build(family, period);
    let delivered = false;
    for (const to of recipients) {
      const result = await input.mailer.send({ to, subject: message.subject, text: message.text }).catch(() => ({ ok: false }));
      if (result.ok) delivered = true;
    }
    if (delivered) return "sent";
  } catch {
    // falls through to release the claim
  }
  await store.releaseDigest(family.id, period.frequency, period.periodStart).catch(() => undefined);
  return "failed";
}

export async function handleDigestSend(input: DigestInput): Promise<DigestResult> {
  if (!input.secret) return { status: 500, body: { error: "server_error" } };
  if (!tokenMatches(input.authorization, input.secret)) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  if (!input.mailConfigured || !input.appUrl) return { status: 500, body: { error: "server_error" } };

  let families: DigestFamilyRow[];
  try {
    families = await input.store.listFamilies();
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
