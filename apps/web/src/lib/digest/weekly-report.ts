import { categorize, computeFocusScore, homeworkDomainsFor, type Category, type UsageEntry } from "@fg/shared";
import { formatDuration, readAllUsage, type DigestChild, type DigestSource } from "./content";
import type { ReportPeriod } from "./schedule";

export type WeeklyReportMessage = { subject: string; text: string; html: string };

/** Total seconds per child id in [start, end); a child without usage may be missing. Rejects on failure. */
export type WeeklyTotals = (childIds: string[], start: string, end: string) => Promise<Record<string, number>>;

export type BuildWeeklyReportInput = {
  familyId: string;
  timezone: string;
  period: ReportPeriod;
  /** Base URL without a trailing slash. */
  appUrl: string;
  source: DigestSource;
  totals: WeeklyTotals;
};

const TOP = 5;

type Ranked = { name: string; seconds: number };

type ChildReport =
  | { name: string; kind: "unavailable" }
  | { name: string; kind: "none" }
  | {
      name: string;
      kind: "usage";
      total: number;
      categories: Ranked[];
      domains: Ranked[];
      focus: string;
      change: string;
    };

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function top(totals: Map<string, number>): Ranked[] {
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP)
    .map(([name, seconds]) => ({ name, seconds }));
}

function dayFormatter(timezone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
  }
}

function focusLine(entries: UsageEntry[], child: DigestChild, timezone: string): string {
  const unavailable = "Focus score not available";
  if (child.homeworkCategories.length === 0 && child.homeworkDomains.length === 0) return unavailable;
  const homework = homeworkDomainsFor([...new Set(entries.map((e) => e.domain))], {
    categories: child.homeworkCategories as Category[],
    extraDomains: child.homeworkDomains,
  });
  const formatter = dayFormatter(timezone);
  const days = new Map<string, UsageEntry[]>();
  for (const e of entries) {
    const day = formatter.format(new Date(e.minuteUtc));
    days.set(day, [...(days.get(day) ?? []), e]);
  }
  const scores: number[] = [];
  for (const dayEntries of days.values()) {
    const { score } = computeFocusScore(dayEntries, homework);
    if (score !== null) scores.push(score);
  }
  if (scores.length === 0) return unavailable;
  return `Focus score: ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)} / 100`;
}

function changeLine(total: number, previous: number | null): string {
  if (previous === null) return "Change versus the week before: not available";
  if (previous === 0) return "Change versus the week before: no activity the week before";
  const diff = total - previous;
  const sign = diff < 0 ? "-" : "+";
  const percent = Math.round((Math.abs(diff) / previous) * 100);
  return `Change versus the week before: ${sign}${percent}% (${sign}${formatDuration(Math.abs(diff))})`;
}

function renderText(reports: ChildReport[], appUrl: string): string {
  const sections = reports.map((r) => {
    const lines = [r.name];
    if (r.kind === "unavailable") lines.push("Usage unavailable");
    else if (r.kind === "none") lines.push("No activity this week");
    else {
      lines.push(`Active time: ${formatDuration(r.total)}`, "Top categories:");
      for (const c of r.categories) lines.push(`  ${c.name}: ${formatDuration(c.seconds)}`);
      lines.push("Top domains:");
      for (const d of r.domains) lines.push(`  ${d.name}: ${formatDuration(d.seconds)}`);
      lines.push(r.focus, r.change);
    }
    return lines.join("\n");
  });
  return [
    ...(sections.length ? [sections.join("\n\n")] : ["No children in this family yet."]),
    `Dashboard: ${appUrl}/dashboard`,
  ].join("\n\n");
}

function table(caption: string, rows: Ranked[]): string {
  const body = rows
    .map((r) => `<tr><th scope="row">${escapeHtml(r.name)}</th><td>${formatDuration(r.seconds)}</td></tr>`)
    .join("");
  return `<table><caption>${caption}</caption><thead><tr><th scope="col">Name</th><th scope="col">Time</th></tr></thead><tbody>${body}</tbody></table>`;
}

function renderHtml(reports: ChildReport[], appUrl: string, title: string): string {
  const sections = reports.map((r) => {
    const parts = [`<h2>${escapeHtml(r.name)}</h2>`];
    if (r.kind === "unavailable") parts.push("<p>Usage unavailable</p>");
    else if (r.kind === "none") parts.push("<p>No activity this week</p>");
    else {
      parts.push(
        `<p>Active time: ${formatDuration(r.total)}</p>`,
        table("Top categories", r.categories),
        table("Top domains", r.domains),
        `<p>${r.focus}</p>`,
        `<p>${r.change}</p>`,
      );
    }
    return parts.join("");
  });
  const body = sections.length ? sections.join("") : "<p>No children in this family yet.</p>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><h1>Weekly report</h1>${body}<p><a href="${escapeHtml(appUrl)}/dashboard">Open the dashboard</a></p></body></html>`;
}

export async function buildWeeklyReport(input: BuildWeeklyReportInput): Promise<WeeklyReportMessage> {
  const { source, period } = input;
  const children = await source.listChildren(input.familyId);

  const loaded = await Promise.all(
    children.map(async (child) => {
      try {
        return { child, entries: await readAllUsage(source, child.id, period.start, period.end) };
      } catch {
        return { child, entries: null };
      }
    }),
  );

  const withUsage = loaded.filter((l) => l.entries && l.entries.length > 0).map((l) => l.child.id);
  let previous: Record<string, number> | null = null;
  if (withUsage.length > 0) {
    try {
      previous = await input.totals(withUsage, period.prevStart, period.start);
    } catch {
      previous = null;
    }
  }

  const reports: ChildReport[] = loaded.map(({ child, entries }): ChildReport => {
    if (entries === null) return { name: child.name, kind: "unavailable" };
    if (entries.length === 0) return { name: child.name, kind: "none" };
    const byDomain = new Map<string, number>();
    const byCategory = new Map<string, number>();
    let total = 0;
    for (const e of entries) {
      total += e.seconds;
      byDomain.set(e.domain, (byDomain.get(e.domain) ?? 0) + e.seconds);
      const category = categorize(e.domain);
      byCategory.set(category, (byCategory.get(category) ?? 0) + e.seconds);
    }
    return {
      name: child.name,
      kind: "usage",
      total,
      categories: top(byCategory),
      domains: top(byDomain),
      focus: focusLine(entries, child, input.timezone),
      change: changeLine(total, previous ? (previous[child.id] ?? 0) : null),
    };
  });

  const lastDay = new Date(Date.parse(`${period.periodStart}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
  const subject = `Family Guardian: weekly report ${period.periodStart} to ${lastDay}`;
  return { subject, text: renderText(reports, input.appUrl), html: renderHtml(reports, input.appUrl, subject) };
}
