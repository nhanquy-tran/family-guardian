import type { UsageEntry } from "@fg/shared";
import { describe, expect, it, vi } from "vitest";
import type { DigestChild, DigestSource } from "./content";
import type { ReportPeriod } from "./schedule";
import { buildWeeklyReport } from "./weekly-report";

const APP_URL = "https://app.example.test";
const WEEK: ReportPeriod = {
  frequency: "weekly_report",
  periodStart: "2026-11-09",
  start: "2026-11-09T00:00:00.000Z",
  end: "2026-11-16T00:00:00.000Z",
  prevStart: "2026-11-02T00:00:00.000Z",
};
const ZURICH_WEEK: ReportPeriod = {
  frequency: "weekly_report",
  periodStart: "2026-10-19",
  start: "2026-10-18T22:00:00.000Z",
  end: "2026-10-25T23:00:00.000Z",
  prevStart: "2026-10-11T22:00:00.000Z",
};

const child = (id: string, name: string, over: Partial<DigestChild> = {}): DigestChild => ({
  id,
  name,
  homeworkCategories: ["education"],
  homeworkDomains: [],
  ...over,
});

/** `count` consecutive minutes of `domain` on `day` starting at 10:00 UTC plus `startMinute`, 60 s each. */
function minutes(day: string, domain: string, count: number, startMinute = 0): UsageEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const m = startMinute + i;
    const hh = String(10 + Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return { minuteUtc: `${day}T${hh}:${mm}:00.000Z`, domain, seconds: 60 };
  });
}

const at = (minuteUtc: string, domain: string): UsageEntry => ({ minuteUtc, domain, seconds: 60 });

type Opts = {
  families?: Record<string, DigestChild[]>;
  usage?: Record<string, UsageEntry[] | ((from: number, to: number) => UsageEntry[])>;
  failUsageFor?: string[];
  prev?: Record<string, number>;
  failTotals?: boolean;
};

function fake(opts: Opts) {
  const inPeriod = (iso: string, start: string, end: string) => Date.parse(iso) >= Date.parse(start) && Date.parse(iso) < Date.parse(end);
  const listChildren = vi.fn(async (familyId: string) => opts.families?.[familyId] ?? []);
  const listIncidents = vi.fn(async () => []);
  const readUsage = vi.fn(async (childId: string, start: string, end: string, from: number, to: number) => {
    if (opts.failUsageFor?.includes(childId)) throw new Error("usage read failed");
    const source = opts.usage?.[childId] ?? [];
    if (typeof source === "function") return source(from, to);
    return source.filter((e) => inPeriod(e.minuteUtc, start, end)).slice(from, to + 1);
  });
  const totals = vi.fn(async (childIds: string[], _start: string, _end: string) => {
    if (opts.failTotals) throw new Error("totals failed");
    return Object.fromEntries(childIds.map((id) => [id, opts.prev?.[id] ?? 0]));
  });
  const source: DigestSource = { listChildren, listIncidents, readUsage };
  return { source, listChildren, readUsage, totals };
}

const build = (f: ReturnType<typeof fake>, over: { period?: ReportPeriod; timezone?: string; familyId?: string } = {}) =>
  buildWeeklyReport({
    familyId: over.familyId ?? "fam-a",
    timezone: over.timezone ?? "UTC",
    period: over.period ?? WEEK,
    appUrl: APP_URL,
    source: f.source,
    totals: f.totals,
  });

/** The part of the text from `name` to the next of `others` (or the end). */
function section(text: string, name: string, others: string[]): string {
  const from = text.indexOf(name);
  expect(from, name).toBeGreaterThanOrEqual(0);
  const ends = others.map((o) => text.indexOf(o, from + name.length)).filter((i) => i > from);
  return text.slice(from, ends.length ? Math.min(...ends) : undefined);
}

describe("buildWeeklyReport", () => {
  it("Full child section", async () => {
    // minutes per domain: youtube 200, roblox 150, khanacademy 100, wikipedia 60, tiktok 40, bbc 30, github 20 = 600 min = 10 h
    const usage = [
      ...minutes("2026-11-10", "youtube.com", 200, 0),
      ...minutes("2026-11-10", "roblox.com", 150, 200),
      ...minutes("2026-11-10", "khanacademy.org", 100, 350),
      ...minutes("2026-11-10", "wikipedia.org", 60, 450),
      ...minutes("2026-11-10", "tiktok.com", 40, 510),
      ...minutes("2026-11-10", "bbc.com", 30, 550),
      ...minutes("2026-11-10", "github.com", 20, 580),
    ];
    // previous week 8 h = 28800 s; change = (10 - 8) / 8 = +25%, +2 h 00 min
    const f = fake({ families: { "fam-a": [child("c1", "Mia")] }, usage: { c1: usage }, prev: { c1: 28_800 } });
    const { text, html } = await build(f);

    for (const out of [text, html]) {
      expect(out).toContain("Mia");
      expect(out).toContain("10 h 00 min");
      expect(out).toContain("+25%");
      expect(out).toContain("+2 h 00 min");
      // top 5 domains by seconds, in order, with times (200, 150, 100, 60, 40 minutes)
      const domains = ["youtube.com", "roblox.com", "khanacademy.org", "wikipedia.org", "tiktok.com"];
      const at = domains.map((d) => out.indexOf(d));
      expect(at.every((i) => i >= 0)).toBe(true);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
      for (const t of ["3 h 20 min", "2 h 30 min", "1 h 40 min", "1 h 00 min", "40 min"]) expect(out).toContain(t);
      expect(out).not.toContain("bbc.com");
      expect(out).not.toContain("github.com");
      // categories: entertainment 200, education 160, games 150, social 40, news 30; productivity (20) is cut
      const cats = ["entertainment", "education", "games", "social", "news"].map((c) => out.indexOf(c));
      expect(cats.every((i) => i >= 0)).toBe(true);
      expect([...cats].sort((a, b) => a - b)).toEqual(cats);
      expect(out).toContain("2 h 40 min");
      expect(out).not.toContain("productivity");
    }
    // the previous week is aggregated in SQL by child id over its own range
    expect(f.totals).toHaveBeenCalledWith(["c1"], WEEK.prevStart, WEEK.start);
  });

  it("Focus score is the mean of daily scores", async () => {
    // day 1 (11-10): 10 homework minutes only = 100. day 2 (11-11): 5 homework minutes at 10:00 and 5 other at 12:00
    // (gap over 5 minutes, no switch) = 50. day 3 has no usage. (100 + 50) / 2 = 75
    const usage = [
      ...minutes("2026-11-10", "khanacademy.org", 10, 0),
      ...minutes("2026-11-11", "khanacademy.org", 5, 0),
      ...minutes("2026-11-11", "youtube.com", 5, 120),
    ];
    const f = fake({ families: { "fam-a": [child("c1", "Mia")] }, usage: { c1: usage } });
    const { text } = await build(f);
    expect(text).toMatch(/Focus score[^\n]*75/);
  });

  it("Focus days follow the family timezone across daylight saving", async () => {
    // Zurich: 24 Oct has the homework minute (21:30Z = 23:30 CEST), 25 Oct (25 h) has two non-homework minutes
    // (24th 22:30Z = 00:30 CEST on the 25th, 25th 22:30Z = 23:30 CET). Scores 100 and 0, mean 50.
    const usage = [
      at("2026-10-24T21:30:00.000Z", "khanacademy.org"),
      at("2026-10-24T22:30:00.000Z", "youtube.com"),
      at("2026-10-25T22:30:00.000Z", "youtube.com"),
    ];
    const f = fake({ families: { "fam-a": [child("c1", "Mia")] }, usage: { c1: usage } });
    const { text } = await build(f, { period: ZURICH_WEEK, timezone: "Europe/Zurich" });
    expect(text).toMatch(/Focus score[^\n]*50/);
  });

  it("No activity", async () => {
    const f = fake({
      families: { "fam-a": [child("c1", "Ava"), child("c2", "Ben")] },
      usage: { c2: minutes("2026-11-10", "youtube.com", 30) },
      prev: { c2: 600 },
    });
    const { text, html } = await build(f);
    const ava = section(text, "Ava", ["Ben"]).toLowerCase();
    expect(ava).toContain("no activity this week");
    for (const word of ["categor", "domain", "focus", "change", "youtube", " min"]) expect(ava, word).not.toContain(word);
    const ben = section(text, "Ben", ["Ava"]);
    expect(ben).toContain("youtube.com");
    expect(ben).toContain("30 min");
    expect(ben).not.toContain("No activity this week");
    expect(html).toContain("No activity this week");
  });

  it("Partial cases", async () => {
    const noHomework = fake({
      families: { "fam-a": [child("c1", "Mia", { homeworkCategories: [], homeworkDomains: [] })] },
      usage: { c1: minutes("2026-11-10", "youtube.com", 30) },
    });
    expect((await build(noHomework)).text).toContain("Focus score not available");

    const noPrev = fake({
      families: { "fam-a": [child("c1", "Mia")] },
      usage: { c1: minutes("2026-11-10", "youtube.com", 30) },
      prev: { c1: 0 },
    });
    const prev = (await build(noPrev)).text;
    expect(prev).toContain("no activity the week before");
    expect(prev).not.toContain("%");

    const empty = fake({ families: { "fam-a": [] } });
    expect((await build(empty)).text).toContain("No children in this family yet.");
  });

  it("Read failures stay local", async () => {
    const families = { "fam-a": [child("c1", "Ava"), child("c2", "Ben")] };
    const ben = minutes("2026-11-10", "khanacademy.org", 30);

    const failing = fake({ families, usage: { c1: minutes("2026-11-10", "tiktok.com", 5), c2: ben }, failUsageFor: ["c1"] });
    const a = (await build(failing)).text;
    expect(section(a, "Ava", ["Ben"])).toContain("Usage unavailable");
    expect(section(a, "Ava", ["Ben"])).not.toContain("tiktok.com");
    expect(section(a, "Ben", ["Ava"])).toContain("khanacademy.org");

    // every page full: more than 30 pages for c1 is an error for c1 only, and the reads stop near the cap
    const rows = (from: number, to: number) => Array.from({ length: to - from + 1 }, () => at("2026-11-10T10:00:00.000Z", "tiktok.com"));
    const huge = fake({ families, usage: { c1: rows, c2: ben } });
    const b = (await build(huge)).text;
    expect(section(b, "Ava", ["Ben"])).toContain("Usage unavailable");
    expect(section(b, "Ava", ["Ben"])).not.toContain("tiktok.com");
    expect(section(b, "Ben", ["Ava"])).toContain("khanacademy.org");
    expect(huge.readUsage.mock.calls.filter((c) => c[0] === "c1").length).toBeLessThanOrEqual(31);

    const noTotals = fake({ families, usage: { c1: minutes("2026-11-10", "tiktok.com", 5), c2: ben }, failTotals: true });
    const c = (await build(noTotals)).text;
    expect(c).toContain("not available");
    expect(c).toContain("tiktok.com");
    expect(c).toContain("khanacademy.org");
    expect(c).not.toContain("Usage unavailable");
  });

  it("Accessible HTML without trackers", async () => {
    const f = fake({
      families: { "fam-a": [child("c1", "<b>Mia</b>")] },
      usage: { c1: [...minutes("2026-11-10", "youtube.com", 20), ...minutes("2026-11-10", "roblox.com", 10, 20)] },
      prev: { c1: 600 },
    });
    const { html, text } = await build(f);
    expect(html).toMatch(/<html[^>]*\slang=/);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain("<th scope=");
    for (const tag of ["<img", "<script", "<link"]) expect(html, tag).not.toContain(tag);
    expect(html).toContain("&lt;b&gt;");
    expect(html).not.toContain("<b>Mia");
    for (const out of [html, text]) {
      const urls = out.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
      expect(urls.length).toBeGreaterThan(0);
      expect(new Set(urls)).toEqual(new Set([`${APP_URL}/dashboard`]));
    }
  });

  it("Subject and only the family's data", async () => {
    const f = fake({
      families: { "fam-a": [child("a1", "Mia")], "fam-b": [child("b1", "Zoe")] },
      usage: { a1: minutes("2026-11-10", "youtube.com", 10), b1: minutes("2026-11-10", "tiktok.com", 10) },
    });
    const { subject, text, html } = await build(f, { familyId: "fam-a" });
    expect(subject).toBe("Family Guardian: weekly report 2026-11-09 to 2026-11-15");
    for (const out of [text, html]) {
      expect(out).not.toContain("Zoe");
      expect(out).not.toContain("tiktok.com");
    }
    expect(f.listChildren.mock.calls.map((c) => c[0])).toEqual(["fam-a"]);
    expect(new Set(f.readUsage.mock.calls.map((c) => c[0]))).toEqual(new Set(["a1"]));
    for (const call of f.totals.mock.calls) expect(call[0]).toEqual(["a1"]);
  });
});
