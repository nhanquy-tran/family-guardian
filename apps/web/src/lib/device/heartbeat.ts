import type { HeartbeatResponse } from "@fg/shared";

export interface HeartbeatStore {
  findDevice(tokenHash: string): Promise<{ deviceId: string; rulesVersion: number } | null>;
  upsertUsage(rows: { device_id: string; minute_utc: string; domain: string; seconds: number }[]): Promise<void>;
  updateDevice(deviceId: string, patch: { last_seen_at: string; browser: string; extension_version: string }): Promise<void>;
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

export async function handleHeartbeat(_input: HeartbeatInput): Promise<HeartbeatResult> {
  throw new Error("not implemented");
}
