import { computeFocusScore, homeworkDomainsFor, type Category, type UsageEntry } from "@fg/shared";
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
  /** Site-access incidents of the children's devices that started in [start, end). */
  listSiteAccessIncidents(childIds: string[], start: string, end: string): Promise<DigestIncident[]>;
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

const PAGE = 1000;
const MAX_PAGES = 30;
const TOP_DOMAINS = 3;

export async function readAllUsage(source: DigestSource, childId: string, start: string, end: string): Promise<UsageEntry[]> {
  const all: UsageEntry[] = [];
  // One page past the cap: any row there means the child has more data than we read, which is an error.
  for (let page = 0; page <= MAX_PAGES; page++) {
    const rows = await source.readUsage(childId, start, end, page * PAGE, page * PAGE + PAGE - 1);
    if (page === MAX_PAGES) {
      if (rows.length > 0) throw new Error("usage over the page cap");
      break;
    }
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

function timeFormatter(timezone: string, withDate: boolean): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  if (withDate) Object.assign(options, { year: "numeric", month: "2-digit", day: "2-digit" });
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: timezone });
  } catch {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });
  }
}

function usageLines(entries: UsageEntry[], child: DigestChild): string[] {
  if (entries.length === 0) return ["Active time: No activity"];

  const byDomain = new Map<string, number>();
  for (const e of entries) byDomain.set(e.domain, (byDomain.get(e.domain) ?? 0) + e.seconds);
  const top = [...byDomain.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_DOMAINS);

  const lines = [`Active time: ${formatDuration([...byDomain.values()].reduce((a, b) => a + b, 0))}`, "Top sites:"];
  for (const [domain, seconds] of top) lines.push(`  ${domain}: ${formatDuration(seconds)}`);

  if (child.homeworkCategories.length === 0 && child.homeworkDomains.length === 0) {
    lines.push("Focus score not available, choose homework sites in the dashboard");
  } else {
    const homework = homeworkDomainsFor([...byDomain.keys()], {
      categories: child.homeworkCategories as Category[],
      extraDomains: child.homeworkDomains,
    });
    const { score } = computeFocusScore(entries, homework);
    lines.push(score === null ? "Focus score not available" : `Focus score: ${score} / 100`);
  }
  return lines;
}

export async function buildDigest(input: BuildDigestInput): Promise<DigestMessage> {
  const { source, period } = input;
  const children = await source.listChildren(input.familyId);
  const incidents = children.length
    ? await source.listIncidents(
        children.map((c) => c.id),
        period.start,
        period.end,
      )
    : [];

  const weekly = period.frequency === "weekly";
  const formatter = timeFormatter(input.timezone, weekly);
  const clock = (iso: string) => formatter.format(new Date(iso)).replace(",", "");

  const sections: string[] = [];
  for (const child of children) {
    const lines = [child.name];
    const own = incidents.filter((i) => i.childId === child.id);
    if (own.length === 0) lines.push("No offline incidents");
    else {
      lines.push("Offline incidents:");
      for (const i of own) {
        const to = i.resolvedAt ? clock(i.resolvedAt) : "still offline";
        lines.push(`  ${i.browser} on ${i.os}: from ${clock(i.startedAt)} to ${to}`);
      }
    }
    try {
      lines.push(...usageLines(await readAllUsage(source, child.id, period.start, period.end), child));
    } catch {
      lines.push("Usage unavailable");
    }
    sections.push(lines.join("\n"));
  }

  const lastDay = new Date(Date.parse(`${period.periodStart}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
  const subject = weekly
    ? `Family Guardian: weekly digest ${period.periodStart} to ${lastDay}`
    : `Family Guardian: daily digest ${period.periodStart}`;
  const text = [
    ...(sections.length ? [sections.join("\n\n")] : ["No children in this family yet."]),
    "An offline laptop is normal if it was switched off.",
    `Dashboard: ${input.appUrl}/dashboard`,
  ].join("\n\n");
  return { subject, text };
}
