import { computeFocusScore, homeworkDomainsFor, categorize, type Category } from "@fg/shared";
import { describe, expect, it } from "vitest";
import { generate, LEO, MIA, NOAH, STAGES, TIMEZONE, type Fixture, type UsageRow } from "./scenario.ts";
import { addDays, dateKey, localDate, localMinuteOfDay, zonedToUtc } from "./time.ts";

const NOW = new Date("2026-11-18T09:30:00Z"); // Wednesday 16:30 in Ho Chi Minh City
const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

function deviceIdsOf(f: Fixture, childId: string): Set<string> {
  return new Set(f.devices.filter((d) => d.child_id === childId).map((d) => d.id));
}

function usageOf(f: Fixture, childId: string): UsageRow[] {
  const ids = deviceIdsOf(f, childId);
  return f.usage.filter((u) => ids.has(u.device_id));
}

function byLocalDay(rows: UsageRow[]): Map<string, UsageRow[]> {
  const days = new Map<string, UsageRow[]>();
  for (const r of rows) {
    const key = dateKey(localDate(Date.parse(r.minute_utc), TIMEZONE));
    days.set(key, [...(days.get(key) ?? []), r]);
  }
  return days;
}

function dailyScores(f: Fixture, childId: string): Map<string, number | null> {
  const child = f.children.find((c) => c.id === childId);
  if (!child) throw new Error("child missing");
  const scores = new Map<string, number | null>();
  for (const [day, rows] of byLocalDay(usageOf(f, childId))) {
    const domains = homeworkDomainsFor(
      rows.map((r) => r.domain),
      { categories: child.homework_categories as Category[], extraDomains: child.homework_domains },
    );
    const entries = rows.map((r) => ({ minuteUtc: r.minute_utc, domain: r.domain, seconds: r.seconds }));
    scores.set(day, computeFocusScore(entries, domains).score);
  }
  return scores;
}

function gamesSecondsByDay(f: Fixture, childId: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const [day, rows] of byLocalDay(usageOf(f, childId))) {
    out.set(day, rows.filter((r) => categorize(r.domain) === "games").reduce((s, r) => s + r.seconds, 0));
  }
  return out;
}

const today = localDate(NOW.getTime(), TIMEZONE);
const startOfDay = (offset: number) => zonedToUtc(addDays(today, offset), 0, 0, TIMEZONE);

describe("stages", () => {
  it("are ordered and cumulative", () => {
    expect(STAGES).toEqual(["empty", "onboarded", "week", "rules-applied", "alerts"]);
  });

  it("empty has a parent and nothing else", () => {
    const f = generate("empty", NOW);
    expect(f.parent.email).toMatch(/@e2e\.family-guardian\.test$/);
    expect(f.children).toEqual([]);
    expect(f.devices).toEqual([]);
    expect(f.usage).toEqual([]);
  });

  it("onboarded has three children, Noah without devices, and no usage", () => {
    const f = generate("onboarded", NOW);
    expect(f.children.map((c) => c.name)).toEqual(["Mia", "Leo", "Noah"]);
    expect(deviceIdsOf(f, MIA).size).toBe(2);
    expect(deviceIdsOf(f, LEO).size).toBe(1);
    expect(deviceIdsOf(f, NOAH).size).toBe(0);
    expect(f.usage).toEqual([]);
    for (const d of f.devices) expect(NOW.getTime() - Date.parse(d.last_seen_at ?? "")).toBeLessThan(5 * 60_000);
  });

  it("is deterministic for the same clock", () => {
    expect(generate("alerts", NOW)).toEqual(generate("alerts", NOW));
  });

  it("uses stable ids across stages", () => {
    const a = generate("onboarded", NOW);
    const b = generate("alerts", new Date(NOW.getTime() + 86_400_000));
    expect(b.children.map((c) => c.id)).toEqual(a.children.map((c) => c.id));
    expect(b.devices.map((d) => d.id)).toEqual(a.devices.map((d) => d.id));
  });
});

describe("usage rows", () => {
  const f = generate("week", NOW);

  it("cover the last seven local days and never the future", () => {
    const first = startOfDay(-6);
    for (const u of f.usage) {
      const t = Date.parse(u.minute_utc);
      expect(t).toBeGreaterThanOrEqual(first);
      expect(t).toBeLessThanOrEqual(NOW.getTime());
    }
    expect(byLocalDay(usageOf(f, LEO)).size).toBe(7);
  });

  it("hold only privacy-safe fields that satisfy the schema", () => {
    const seen = new Set<string>();
    for (const u of f.usage) {
      expect(Object.keys(u).sort()).toEqual(["device_id", "domain", "minute_utc", "seconds"]);
      expect(u.domain).toMatch(DOMAIN_RE);
      expect(u.seconds).toBeGreaterThanOrEqual(1);
      expect(u.seconds).toBeLessThanOrEqual(60);
      expect(Date.parse(u.minute_utc) % 60_000).toBe(0);
      const key = `${u.device_id}|${u.minute_utc}|${u.domain}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("make Mia focused and Leo distracted on school days", () => {
    const mia = [...dailyScores(f, MIA).values()].filter((s): s is number => s !== null);
    const leo = [...dailyScores(f, LEO).values()].filter((s): s is number => s !== null);
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(avg(mia)).toBeGreaterThanOrEqual(55);
    expect(avg(leo)).toBeLessThanOrEqual(35);
  });

  it("let Leo play over an hour of games on most days before rules exist", () => {
    const over = [...gamesSecondsByDay(f, LEO).values()].filter((s) => s > 3600);
    expect(over.length).toBeGreaterThanOrEqual(4);
    expect(usageOf(f, LEO).some((u) => u.domain === "tiktok.com")).toBe(true);
  });
});

describe("rules-applied", () => {
  const f = generate("rules-applied", NOW);
  const blockFrom = startOfDay(-3);
  const hoursFrom = startOfDay(-1);

  it("blocks tiktok.com and the social category for Leo from three days ago", () => {
    expect(f.blockRules.filter((r) => r.child_id === LEO).map((r) => [r.kind, r.value])).toEqual([
      ["domain", "tiktok.com"],
      ["category", "social"],
    ]);
    const after = usageOf(f, LEO).filter((u) => Date.parse(u.minute_utc) >= blockFrom);
    expect(after.some((u) => categorize(u.domain) === "social")).toBe(false);
    const leoDevices = deviceIdsOf(f, LEO);
    const attempts = f.blockEvents.filter((e) => leoDevices.has(e.device_id) && e.domain === "tiktok.com");
    expect(attempts.length).toBeGreaterThan(0);
    for (const e of attempts) expect(Date.parse(e.at)).toBeGreaterThanOrEqual(blockFrom);
  });

  it("caps Leo's games at 60 minutes a day once the limit exists", () => {
    expect(f.categoryLimits).toContainEqual({ child_id: LEO, category: "games", minutes_per_day: 60 });
    for (const [day, seconds] of gamesSecondsByDay(f, LEO)) {
      if (Date.parse(`${day}T12:00:00Z`) >= blockFrom) expect(seconds).toBeLessThanOrEqual(3600);
    }
    const leoDevices = deviceIdsOf(f, LEO);
    expect(f.blockEvents.some((e) => leoDevices.has(e.device_id) && categorize(e.domain) === "games")).toBe(true);
  });

  it("keeps Leo inside 07:00-20:00 from yesterday", () => {
    const leo = f.children.find((c) => c.id === LEO);
    expect([leo?.allowed_start, leo?.allowed_end]).toEqual(["07:00", "20:00"]);
    for (const u of usageOf(f, LEO)) {
      const t = Date.parse(u.minute_utc);
      if (t < hoursFrom) continue;
      const m = localMinuteOfDay(t, TIMEZONE);
      expect(m).toBeGreaterThanOrEqual(7 * 60);
      expect(m).toBeLessThan(20 * 60);
    }
  });

  it("leaves days before the rules unchanged", () => {
    const week = generate("week", NOW);
    const before = (x: Fixture) => usageOf(x, LEO).filter((u) => Date.parse(u.minute_utc) < blockFrom);
    expect(before(f)).toEqual(before(week));
  });

  it("adds family category overrides for sites the seed list does not know", () => {
    expect(f.categoryOverrides).toEqual([
      { domain: "mathplayground.com", category: "education" },
      { domain: "coolmathgames.com", category: "games" },
    ]);
  });
});

describe("alerts", () => {
  const f = generate("alerts", NOW);
  const familyPc = f.devices.find((d) => d.child_id === MIA && d.browser === "edge");

  it("has Mia's family PC offline for three days with one open alert", () => {
    expect(familyPc).toBeDefined();
    const lastSeen = Date.parse(familyPc?.last_seen_at ?? "");
    expect(NOW.getTime() - lastSeen).toBeGreaterThanOrEqual(3 * 86_400_000 - 60_000);
    expect(f.usage.some((u) => u.device_id === familyPc?.id && Date.parse(u.minute_utc) > lastSeen)).toBe(false);
    expect(f.alerts).toHaveLength(1);
    expect(f.alerts[0]).toMatchObject({ device_id: familyPc?.id, kind: "offline", incident_last_seen_at: familyPc?.last_seen_at });
  });
});
