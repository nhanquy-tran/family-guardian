import { timingSafeEqual } from "node:crypto";
import { hashDeviceToken } from "../device/token";

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
  /** Records the incident (emailed_at stays null); false if the row already exists. */
  claimAlert(deviceId: string, lastSeenAt: string, emailedAt: null): Promise<boolean>;
  /** Sets resolved_at = now on incidents whose device has reported again. */
  resolveReturned(now: string): Promise<void>;
}

export type OfflineMessage = { to: string; subject: string; text: string };

export interface Mailer {
  send(message: OfflineMessage): Promise<{ ok: boolean }>;
}

export type OfflineCounts = { recorded: number; skipped: number };

export type OfflineInput = {
  authorization: string | null;
  secret: string | undefined;
  now: Date;
  store: OfflineAlertStore;
  log: (counts: OfflineCounts) => void;
};

export type OfflineResult = {
  status: 200 | 401 | 500;
  body: OfflineCounts | { error: string };
};

function tokenMatches(authorization: string | null, secret: string): boolean {
  const prefix = "Bearer ";
  const token = authorization?.startsWith(prefix) ? authorization.slice(prefix.length) : "";
  // Equal-length digests keep the comparison constant-time whatever the token length.
  const equal = timingSafeEqual(Buffer.from(hashDeviceToken(token)), Buffer.from(hashDeviceToken(secret)));
  return equal && token.length > 0;
}

export async function handleOfflineAlerts(input: OfflineInput): Promise<OfflineResult> {
  if (!input.secret) return { status: 500, body: { error: "server_error" } };
  if (!tokenMatches(input.authorization, input.secret)) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  throw new Error("not implemented");
}
