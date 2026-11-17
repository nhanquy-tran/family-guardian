export type OfflineDevice = {
  deviceId: string;
  familyId: string;
  childName: string;
  browser: string;
  os: string;
  /** ISO timestamp of the device's last_seen_at (the incident id). */
  lastSeenAt: string;
};

export interface OfflineAlertStore {
  findOfflineDevices(now: string): Promise<OfflineDevice[]>;
  hasRecentEmail(deviceId: string, since: string): Promise<boolean>;
  claimAlert(deviceId: string, lastSeenAt: string, emailedAt: string | null): Promise<boolean>;
  releaseAlert(deviceId: string, lastSeenAt: string): Promise<void>;
  listParentEmails(familyId: string): Promise<string[]>;
}

export type OfflineMessage = { to: string; subject: string; text: string };

export interface Mailer {
  send(message: OfflineMessage): Promise<{ ok: boolean }>;
}

export type OfflineCounts = { sent: number; skipped: number; failed: number; throttled: number };

export type OfflineInput = {
  authorization: string | null;
  secret: string | undefined;
  mailConfigured: boolean;
  now: Date;
  store: OfflineAlertStore;
  mailer: Mailer;
  log: (counts: OfflineCounts) => void;
};

export type OfflineResult = {
  status: 200 | 401 | 500;
  body: OfflineCounts | { error: string };
};

export async function handleOfflineAlerts(_input: OfflineInput): Promise<OfflineResult> {
  throw new Error("not implemented");
}
