import type { UsageEntry } from "@fg/shared";
import type { DuePeriod } from "./schedule";

export type DigestChild = {
  id: string;
  name: string;
  homeworkCategories: string[];
  homeworkDomains: string[];
};

export type DigestIncident = {
  childId: string;
  browser: string;
  os: string;
  /** ISO timestamp of incident_last_seen_at. */
  startedAt: string;
  /** ISO timestamp, or null while the device is still offline. */
  resolvedAt: string | null;
};

export interface DigestSource {
  listChildren(familyId: string): Promise<DigestChild[]>;
  /** Incidents of the children's devices that started in [start, end). */
  listIncidents(childIds: string[], start: string, end: string): Promise<DigestIncident[]>;
  /** Usage rows of one child in [start, end), rows `from` to `to` inclusive (a page). Rejects on failure. */
  readUsage(childId: string, start: string, end: string, from: number, to: number): Promise<UsageEntry[]>;
}

export type BuildDigestInput = {
  familyId: string;
  timezone: string;
  period: DuePeriod;
  /** Base URL without a trailing slash. */
  appUrl: string;
  source: DigestSource;
};

export type DigestMessage = { subject: string; text: string };

export async function buildDigest(_input: BuildDigestInput): Promise<DigestMessage> {
  throw new Error("not implemented");
}
