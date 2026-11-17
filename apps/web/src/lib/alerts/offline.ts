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

const NORMAL_TEXT = "This is normal if the laptop was switched off. If it should be on, check the browser.";
const THROTTLE_MS = 24 * 60 * 60 * 1000;

function tokenMatches(authorization: string | null, secret: string): boolean {
  const prefix = "Bearer ";
  const token = authorization?.startsWith(prefix) ? authorization.slice(prefix.length) : "";
  // Equal-length digests keep the comparison constant-time whatever the token length.
  const equal = timingSafeEqual(Buffer.from(hashDeviceToken(token)), Buffer.from(hashDeviceToken(secret)));
  return equal && token.length > 0;
}

function formatUtc(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function buildMessage(device: OfflineDevice, to: string): OfflineMessage {
  return {
    to,
    subject: `${device.childName}: laptop offline`,
    text: [
      `${device.childName}'s ${device.browser} on ${device.os} has not reported since ${formatUtc(device.lastSeenAt)}.`,
      "",
      NORMAL_TEXT,
    ].join("\n"),
  };
}

type Outcome = keyof OfflineCounts;

async function processDevice(device: OfflineDevice, input: OfflineInput): Promise<Outcome> {
  const { store, mailer, now } = input;
  const since = new Date(now.getTime() - THROTTLE_MS).toISOString();
  const throttled = await store.hasRecentEmail(device.deviceId, since);
  const claimed = await store.claimAlert(device.deviceId, device.lastSeenAt, throttled ? null : now.toISOString());
  if (!claimed) return "skipped";
  if (throttled) return "throttled";

  try {
    const parents = await store.listParentEmails(device.familyId);
    if (parents.length === 0) return "skipped";
    const results = await Promise.all(
      parents.map((to) => mailer.send(buildMessage(device, to)).catch(() => ({ ok: false }))),
    );
    if (results.some((r) => r.ok)) return "sent";
  } catch {
    // fall through: release the claim so the next run retries
  }
  await store.releaseAlert(device.deviceId, device.lastSeenAt).catch(() => undefined);
  return "failed";
}

export async function handleOfflineAlerts(input: OfflineInput): Promise<OfflineResult> {
  const serverError: OfflineResult = { status: 500, body: { error: "server_error" } };
  if (!input.secret) return serverError;
  if (!tokenMatches(input.authorization, input.secret)) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  if (!input.mailConfigured) return serverError;

  let devices: OfflineDevice[];
  try {
    devices = await input.store.findOfflineDevices(input.now.toISOString());
  } catch {
    return serverError;
  }

  const counts: OfflineCounts = { sent: 0, skipped: 0, failed: 0, throttled: 0 };
  for (const device of devices) {
    let outcome: Outcome;
    try {
      outcome = await processDevice(device, input);
    } catch {
      outcome = "failed";
    }
    counts[outcome] += 1;
  }
  input.log(counts);
  return { status: 200, body: counts };
}
