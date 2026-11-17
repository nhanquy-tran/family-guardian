import type { DigestMessage } from "./content";
import type { DigestFamily, DuePeriod } from "./schedule";

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

export async function handleDigestSend(_input: DigestInput): Promise<DigestResult> {
  throw new Error("not implemented");
}
