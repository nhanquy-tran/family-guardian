import {
  BlockedAttempt,
  HeartbeatEnvelope,
  MAX_BLOCKED_ATTEMPTS,
  MAX_HEARTBEAT_ENTRIES,
  UsageEntry,
  type HeartbeatResponse,
} from "@fg/shared";
import { hashDeviceToken } from "./token";

export interface HeartbeatStore {
  findDevice(tokenHash: string): Promise<{ deviceId: string; rulesVersion: number } | null>;
  upsertUsage(rows: { device_id: string; minute_utc: string; domain: string; seconds: number }[]): Promise<void>;
  insertBlocked(rows: { device_id: string; at: string; domain: string }[]): Promise<void>;
  updateDevice(deviceId: string, patch: { last_seen_at: string; browser: string; extension_version: string }): Promise<void>;
  /** Stub for the cross-browser change: the developer makes it required and implements it. */
  otherUsage?(deviceId: string): Promise<unknown>;
}

export type HeartbeatInput = {
  authorization: string | null;
  rawBody: string;
  now: Date;
  store: HeartbeatStore;
  log: (counts: { accepted: number; skipped: number }) => void;
};

export type HeartbeatResult = {
  status: 200 | 400 | 401 | 413 | 500;
  body: HeartbeatResponse | { error: string };
};

type UsageRow = { device_id: string; minute_utc: string; domain: string; seconds: number };

const MINUTE_MS = 60_000;
const MAX_AGE_MS = 7 * 24 * 60 * MINUTE_MS;
const MAX_AHEAD_MS = 5 * MINUTE_MS;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

const fail = (status: 400 | 401 | 413 | 500, error: string): HeartbeatResult => ({ status, body: { error } });

function keepEntry(raw: unknown, nowMinute: number): { minuteUtc: string; domain: string; seconds: number } | null {
  const parsed = UsageEntry.safeParse(raw);
  if (!parsed.success) return null;
  const { minuteUtc, domain, seconds } = parsed.data;
  const ms = Date.parse(minuteUtc);
  if (Number.isNaN(ms) || ms % MINUTE_MS !== 0) return null;
  if (ms < nowMinute - MAX_AGE_MS || ms > nowMinute + MAX_AHEAD_MS) return null;
  if (!DOMAIN.test(domain)) return null;
  return { minuteUtc: new Date(ms).toISOString(), domain, seconds };
}

function keepBlocked(raw: unknown, now: number): { at: string; domain: string } | null {
  const parsed = BlockedAttempt.safeParse(raw);
  if (!parsed.success) return null;
  const ms = Date.parse(parsed.data.at);
  if (Number.isNaN(ms) || ms < now - MAX_AGE_MS || ms > now + MAX_AHEAD_MS) return null;
  if (!DOMAIN.test(parsed.data.domain)) return null;
  return { at: new Date(ms).toISOString(), domain: parsed.data.domain };
}

export async function handleHeartbeat(input: HeartbeatInput): Promise<HeartbeatResult> {
  const { store, now } = input;

  const match = /^bearer (\S+)$/i.exec(input.authorization ?? "");
  if (!match) return fail(401, "unauthorized");

  let device: { deviceId: string; rulesVersion: number } | null;
  try {
    device = await store.findDevice(hashDeviceToken(match[1]));
  } catch {
    return fail(500, "server_error");
  }
  if (!device) return fail(401, "unauthorized");

  let json: unknown;
  try {
    json = JSON.parse(input.rawBody);
  } catch {
    return fail(400, "invalid_request");
  }
  const envelope = HeartbeatEnvelope.safeParse(json);
  if (!envelope.success) return fail(400, "invalid_request");
  const { entries, browser, extensionVersion } = envelope.data;
  const blockedRaw = envelope.data.blocked ?? [];
  if (entries.length > MAX_HEARTBEAT_ENTRIES || blockedRaw.length > MAX_BLOCKED_ATTEMPTS) {
    return fail(413, "too_many_entries");
  }

  const nowMinute = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS;
  const rows = new Map<string, UsageRow>();
  let skipped = 0;
  for (const raw of entries) {
    const kept = keepEntry(raw, nowMinute);
    if (!kept) {
      skipped += 1;
      continue;
    }
    rows.set(`${kept.minuteUtc}|${kept.domain}`, {
      device_id: device.deviceId,
      minute_utc: kept.minuteUtc,
      domain: kept.domain,
      seconds: kept.seconds,
    });
  }

  const blocked = new Map<string, { device_id: string; at: string; domain: string }>();
  for (const raw of blockedRaw) {
    const kept = keepBlocked(raw, now.getTime());
    if (!kept) {
      skipped += 1;
      continue;
    }
    blocked.set(`${kept.at}|${kept.domain}`, { device_id: device.deviceId, ...kept });
  }

  try {
    if (rows.size > 0) await store.upsertUsage([...rows.values()]);
    if (blocked.size > 0) await store.insertBlocked([...blocked.values()]);
    await store.updateDevice(device.deviceId, {
      last_seen_at: now.toISOString(),
      browser,
      extension_version: extensionVersion,
    });
  } catch {
    return fail(500, "server_error");
  }

  input.log({ accepted: rows.size, skipped });
  return { status: 200, body: { rulesVersion: device.rulesVersion } };
}
