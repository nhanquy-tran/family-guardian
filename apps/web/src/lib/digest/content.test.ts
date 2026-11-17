import { computeFocusScore, homeworkDomainsFor, type Category, type UsageEntry } from "@fg/shared";
import { describe, expect, it, vi } from "vitest";
import { buildDigest, type DigestChild, type DigestIncident, type DigestSource } from "./content";
import type { DuePeriod } from "./schedule";

const APP_URL = "https://app.example.test";
const DAY: DuePeriod = {
  frequency: "daily",
  periodStart: "2026-11-17",
  start: "2026-11-17T00:00:00.000Z",
  end: "2026-11-18T00:00:00.000Z",
};
const WEEK: DuePeriod = {
  frequency: "weekly",
  periodStart: "2026-11-09",
  start: "2026-11-09T00:00:00.000Z",
  end: "2026-11-16T00:00:00.000Z",
};

const child = (id: string, name: string, over: Partial<DigestChild> = {}): DigestChild => ({
  id,
  name,
  homeworkCategories: ["education"],
  homeworkDomains: [],
  ...over,
});

const incident = (childId: string, over: Partial<DigestIncident> = {}): DigestIncident => ({
  childId,
  browser: "Edge",
  os: "Windows",
  startedAt: "2026-11-17T11:40:00.000Z",
  resolvedAt: "2026-11-17T12:10:00.000Z",
  ...over,
});

/** `count` consecutive minutes of `domain` starting at `day` 10:00 UTC plus `startMinute`, `seconds` each. */
function minutes(day: string, domain: string, count: number, startMinute = 0, seconds = 60): UsageEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const m = startMinute + i;
    const hh = String(10 + Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return { minuteUtc: `${day}T${hh}:${mm}:00.000Z`, domain, seconds };
  });
}

type SourceOpts = {
  families?: Record<string, DigestChild[]>;
  incidents?: DigestIncident[];
  usage?: Record<string, UsageEntry[] | ((from: number, to: number) => UsageEntry[])>;
  failUsageFor?: Record<string, number>; // childId -> page index (0-based) whose read rejects
};

/** Source over in-memory data that honours the period and the requested page, like the database would. */
function fakeSource(opts: SourceOpts) {
  const inPeriod = (iso: string, start: string, end: string) => Date.parse(iso) >= Date.parse(start) && Date.parse(iso) < Date.parse(end);
  const listChildren = vi.fn(async (familyId: string) => opts.families?.[familyId] ?? []);
  const listIncidents = vi.fn(async (childIds: string[], start: string, end: string) =>
    (opts.incidents ?? []).filter((i) => childIds.includes(i.childId) && inPeriod(i.startedAt, start, end)),
  );
  const readUsage = vi.fn(async (childId: string, start: string, end: string, from: number, to: number) => {
    const failPage = opts.failUsageFor?.[childId];
    if (failPage !== undefined && Math.floor(from / 1000) === failPage) throw new Error("usage read failed");
    const source = opts.usage?.[childId] ?? [];
    if (typeof source === "function") return source(from, to);
    return source.filter((e) => inPeriod(e.minuteUtc, start, end)).slice(from, to + 1);
  });
  const source: DigestSource = { listChildren, listIncidents, readUsage };
  return { source, listChildren, listIncidents, readUsage };
}

const build = (s: ReturnType<typeof fakeSource>, over: { period?: DuePeriod; timezone?: string; familyId?: string } = {}) =>
  buildDigest({
    familyId: over.familyId ?? "fam-a",
    timezone: over.timezone ?? "UTC",
    period: over.period ?? DAY,
    appUrl: APP_URL,
    source: s.source,
  });

const focus = (entries: UsageEntry[], c: DigestChild) =>
  computeFocusScore(
    entries,
    homeworkDomainsFor([...new Set(entries.map((e) => e.domain))], {
      categories: c.homeworkCategories as Category[],
      extraDomains: c.homeworkDomains,
    }),
  );

const at = (text: string, needle: string) => {
  const i = text.indexOf(needle);
  expect(i, needle).toBeGreaterThanOrEqual(0);
  return i;
};

describe("buildDigest", () => {
  it("Full child section", async () => {
    const mia = child("c-mia", "Mia");
    // 600 + 480 + 300 + 120 + 60 = 1560 s = 26 min over 5 domains
    const usage = [
      ...minutes("2026-11-17", "khanacademy.org", 10, 0),
      ...minutes("2026-11-17", "youtube.com", 8, 10),
      ...minutes("2026-11-17", "wikipedia.org", 5, 18),
      ...minutes("2026-11-17", "reddit.com", 2, 23),
      ...minutes("2026-11-17", "example.com", 1, 25),
    ];
    const s = fakeSource({ families: { "fam-a": [mia] }, incidents: [incident("c-mia")], usage: { "c-mia": usage } });
    const { subject, text } = await build(s);

    expect(subject).toBe("Family Guardian: daily digest 2026-11-17");
    for (const part of ["Mia", "Edge", "Windows", "11:40", "12:10", `${APP_URL}/dashboard`]) expect(text, part).toContain(part);
    expect(text).toMatch(/\b26\s*(min|m)\b/i);

    // top 3 by seconds: khanacademy.org 600, youtube.com 480, wikipedia.org 300; reddit.com and example.com are left out
    expect(at(text, "khanacademy.org")).toBeLessThan(at(text, "youtube.com"));
    expect(at(text, "youtube.com")).toBeLessThan(at(text, "wikipedia.org"));
    expect(text).not.toContain("reddit.com");
    expect(text).not.toContain("example.com");

    const score = focus(usage, mia).score;
    expect(score).not.toBeNull();
    expect(text).toMatch(new RegExp(`focus score[^\\n]*\\b${score}\\b`, "i"));
  });

  it("Incident times use the family timezone", async () => {
    // 02:40Z and 03:10Z are 11:40 and 12:10 in Tokyo (UTC+9); the period is the Tokyo day 2026-11-17
    const period: DuePeriod = { ...DAY, start: "2026-11-16T15:00:00.000Z", end: "2026-11-17T15:00:00.000Z" };
    const s = fakeSource({
      families: { "fam-a": [child("c-mia", "Mia")] },
      incidents: [incident("c-mia", { startedAt: "2026-11-17T02:40:00.000Z", resolvedAt: "2026-11-17T03:10:00.000Z" })],
    });
    const { text } = await build(s, { period, timezone: "Asia/Tokyo" });
    expect(text).toContain("11:40");
    expect(text).toContain("12:10");
    expect(text).not.toContain("02:40");
  });

  it("Only incidents that started in the period are listed", async () => {
    const s = fakeSource({
      families: { "fam-a": [child("c-mia", "Mia")] },
      incidents: [incident("c-mia", { startedAt: "2026-11-16T23:30:00.000Z", resolvedAt: "2026-11-16T23:50:00.000Z", browser: "Brave" })],
    });
    const { text } = await build(s);
    expect(text).not.toContain("Brave");
    expect(text).toContain("No offline incidents");
  });

  it("Empty and partial cases", async () => {
    const usage = minutes("2026-11-17", "khanacademy.org", 3);

    const open = await build(
      fakeSource({
        families: { "fam-a": [child("c-mia", "Mia")] },
        incidents: [incident("c-mia", { resolvedAt: null })],
        usage: { "c-mia": usage },
      }),
    );
    expect(open.text).toContain("still offline");
    expect(open.text).not.toContain("12:10");

    const quiet = await build(fakeSource({ families: { "fam-a": [child("c-leo", "Leo")] } }));
    expect(quiet.text).toContain("No offline incidents");
    expect(quiet.text).toContain("No activity");
    expect(quiet.text).not.toMatch(/focus score[^\n]*\d/i);

    const noHomework = await build(
      fakeSource({
        families: { "fam-a": [child("c-noa", "Noa", { homeworkCategories: [], homeworkDomains: [] })] },
        usage: { "c-noa": usage },
      }),
    );
    expect(noHomework.text).toContain("khanacademy.org");
    expect(noHomework.text).toMatch(/not available/i);
    expect(noHomework.text).toMatch(/choose homework sites/i);
  });

  it("Weekly period", async () => {
    // per day (2026-11-09 to 2026-11-15): 5 min khanacademy.org + 3 min youtube.com = 8 min; 7 days = 56 min
    const days = ["09", "10", "11", "12", "13", "14", "15"];
    const inWeek = days.flatMap((d) => [
      ...minutes(`2026-11-${d}`, "khanacademy.org", 5, 0),
      ...minutes(`2026-11-${d}`, "youtube.com", 3, 5),
    ]);
    // rows on 2026-11-08 and 2026-11-16 are outside the week and must not count
    const outside = [...minutes("2026-11-08", "outside.com", 4), ...minutes("2026-11-16", "outside.com", 4)];
    const mia = child("c-mia", "Mia");
    const s = fakeSource({ families: { "fam-a": [mia] }, usage: { "c-mia": [...outside, ...inWeek] } });
    const { subject, text } = await build(s, { period: WEEK });

    expect(subject).toBe("Family Guardian: weekly digest 2026-11-09 to 2026-11-15");
    expect(text).toMatch(/\b56\s*(min|m)\b/i);
    expect(at(text, "khanacademy.org")).toBeLessThan(at(text, "youtube.com"));
    expect(text).not.toContain("outside.com");
    const score = focus(inWeek, mia).score;
    expect(score).not.toBeNull();
    expect(text).toMatch(new RegExp(`focus score[^\\n]*\\b${score}\\b`, "i"));
    for (const [, start, end] of s.readUsage.mock.calls) {
      expect([start, end]).toEqual([WEEK.start, WEEK.end]);
    }
  });

  it("Usage over several pages is complete", async () => {
    // 1500 rows of 1 s = 1500 s = 25 min, served in pages of 1000
    const rows = Array.from({ length: 1500 }, (_, i) => ({
      minuteUtc: new Date(Date.parse("2026-11-17T00:00:00Z") + i * 1000).toISOString(),
      domain: "khanacademy.org",
      seconds: 1,
    }));
    const s = fakeSource({ families: { "fam-a": [child("c-mia", "Mia")] }, usage: { "c-mia": rows } });
    const { text } = await build(s);
    expect(text).toMatch(/\b25\s*(min|m)\b/i);
    expect(text).not.toContain("Usage unavailable");
  });

  it("Usage read fails or is too large", async () => {
    const mia = child("c-mia", "Mia");
    const leo = child("c-leo", "Leo");
    const leoUsage = minutes("2026-11-17", "wikipedia.org", 4);

    // 1010 rows are two pages; the second page fails after a full first page of data
    const miaRows = Array.from({ length: 1010 }, (_, i) => ({
      minuteUtc: new Date(Date.parse("2026-11-17T00:00:00Z") + i * 1000).toISOString(),
      domain: "partial-leak.com",
      seconds: 1,
    }));
    const failing = fakeSource({
      families: { "fam-a": [mia, leo] },
      usage: { "c-mia": miaRows, "c-leo": leoUsage },
      failUsageFor: { "c-mia": 1 },
    });
    const a = await build(failing);
    expect(a.text).toContain("Usage unavailable");
    expect(a.text).not.toContain("partial-leak.com");
    expect(a.text).toContain("Leo");
    expect(a.text).toContain("wikipedia.org");

    // every page is full: more than 30 pages exist, which is an error for that child, never a silent cut
    const endless = fakeSource({
      families: { "fam-a": [mia, leo] },
      usage: {
        "c-mia": (from, to) =>
          Array.from({ length: to - from + 1 }, (_, i) => ({
            minuteUtc: new Date(Date.parse("2026-11-17T00:00:00Z") + (from + i) * 1000).toISOString(),
            domain: "full-page.com",
            seconds: 1,
          })),
        "c-leo": leoUsage,
      },
    });
    const b = await build(endless);
    expect(b.text).toContain("Usage unavailable");
    expect(b.text).not.toContain("full-page.com");
    expect(b.text).toContain("wikipedia.org");
    const miaReads = endless.readUsage.mock.calls.filter((c) => c[0] === "c-mia").length;
    expect(miaReads).toBeLessThanOrEqual(31);
  });

  it("Only the family's data", async () => {
    const mia = child("c-mia", "Mia");
    const leo = child("c-leo", "Leo");
    const s = fakeSource({
      families: { "fam-a": [mia], "fam-b": [leo] },
      incidents: [incident("c-mia"), incident("c-leo", { browser: "Brave", os: "Linux" })],
      usage: { "c-mia": minutes("2026-11-17", "khanacademy.org", 3), "c-leo": minutes("2026-11-17", "familyb-secret.com", 3) },
    });
    const { text } = await build(s, { familyId: "fam-a" });

    for (const leak of ["Leo", "familyb-secret.com", "Brave", "Linux"]) expect(text, leak).not.toContain(leak);
    expect(text).toContain("Mia");
    for (const [ids] of s.listIncidents.mock.calls) expect(ids).toEqual(["c-mia"]);
    for (const call of s.readUsage.mock.calls) expect(call[0]).toBe("c-mia");
    expect(s.listChildren).toHaveBeenCalledWith("fam-a");
  });

  it("Plain text with no URL except the dashboard link", async () => {
    const s = fakeSource({
      families: { "fam-a": [child("c-mia", "Mia")] },
      incidents: [incident("c-mia")],
      usage: { "c-mia": minutes("2026-11-17", "khanacademy.org", 3) },
    });
    const { text } = await build(s);
    expect(text.match(/https?:\/\/\S+/g)).toEqual([`${APP_URL}/dashboard`]);
    expect(text).not.toMatch(/<[a-z][^>]*>/i);
  });
});
