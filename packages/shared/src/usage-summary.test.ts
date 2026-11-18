import { describe, expect, it } from "vitest";
import { CATEGORIES } from "./categories";
import {
  buildTimeline,
  dayRangeUtc,
  localDay,
  resolveTimezone,
  summarizeDay,
  summarizeWeek,
} from "./usage-summary";

const HCM = "Asia/Ho_Chi_Minh";
const HOUR_MS = 3_600_000;

describe("Local day boundaries", () => {
  it("Day range in a fixed offset zone", () => {
    // 2026-03-10 00:00 at UTC+7 = 2026-03-09T17:00Z; the next local midnight is 24 h later
    expect(dayRangeUtc("2026-03-10", HCM)).toEqual({
      startUtc: "2026-03-09T17:00:00.000Z",
      endUtc: "2026-03-10T17:00:00.000Z",
    });
  });

  it("Daylight-saving day is 23 hours", () => {
    const { startUtc, endUtc } = dayRangeUtc("2026-03-08", "America/New_York");
    // US clocks jump forward on 2026-03-08, so the local day has 23 h
    expect((Date.parse(endUtc) - Date.parse(startUtc)) / HOUR_MS).toBe(23);
  });

  it("Late UTC minute belongs to next local day", () => {
    // 18:30Z + 7 h = 01:30 on 2026-03-11
    expect(localDay("2026-03-10T18:30:00Z", HCM)).toBe("2026-03-11");
  });
});

describe("Today overview", () => {
  it("Totals and categories", () => {
    const s = summarizeDay([
      { domain: "youtube.com", seconds: 600 },
      { domain: "khanacademy.org", seconds: 300 },
    ]);
    expect(s.totalSeconds).toBe(900); // 600 + 300
    expect(s.byCategory.entertainment).toBe(600);
    expect(s.byCategory.education).toBe(300);
    // 600/900 = 66.7 -> 67 ; 300/900 = 33.3 -> 33
    expect(s.topSites.map((t) => [t.domain, t.share])).toEqual([
      ["youtube.com", 67],
      ["khanacademy.org", 33],
    ]);
  });

  it("Only ten sites", () => {
    // site1.com = 10 s ... site12.com = 120 s; the top 10 are site12 down to site3
    const entries = Array.from({ length: 12 }, (_, i) => ({ domain: `site${i + 1}.com`, seconds: (i + 1) * 10 }));
    const s = summarizeDay(entries);
    expect(s.topSites).toHaveLength(10);
    expect(s.topSites.map((t) => t.seconds)).toEqual([120, 110, 100, 90, 80, 70, 60, 50, 40, 30]);
  });

  it("Empty day", () => {
    const s = summarizeDay([]);
    expect(s.totalSeconds).toBe(0);
    expect(s.topSites).toEqual([]);
    for (const c of CATEGORIES) expect(s.byCategory[c]).toBe(0);
  });
});

describe("Week view", () => {
  it("Seven days with gaps", () => {
    // last day 2026-03-14 -> days 03-08 .. 03-14 (7 days)
    const w = summarizeWeek(
      [
        { minuteUtc: "2026-03-10T09:00:00Z", domain: "youtube.com", seconds: 60 },
        { minuteUtc: "2026-03-13T09:00:00Z", domain: "khanacademy.org", seconds: 45 },
      ],
      "UTC",
      "2026-03-14",
    );
    expect(w.days.map((d) => d.day)).toEqual([
      "2026-03-08",
      "2026-03-09",
      "2026-03-10",
      "2026-03-11",
      "2026-03-12",
      "2026-03-13",
      "2026-03-14",
    ]);
    const empty = w.days.filter((d) => d.totalSeconds === 0);
    expect(empty).toHaveLength(5); // 7 days - 2 days with data
    expect(w.days[2]!.totalSeconds).toBe(60);
    expect(w.days[5]!.totalSeconds).toBe(45);
  });

  it("Days split by timezone", () => {
    const w = summarizeWeek([{ minuteUtc: "2026-03-10T18:30:00Z", domain: "youtube.com", seconds: 30 }], HCM, "2026-03-11");
    const byDay = Object.fromEntries(w.days.map((d) => [d.day, d.totalSeconds]));
    expect(byDay["2026-03-11"]).toBe(30);
    expect(byDay["2026-03-10"]).toBe(0);
  });

  it("Week top sites", () => {
    const w = summarizeWeek(
      [
        { minuteUtc: "2026-03-09T10:00:00Z", domain: "youtube.com", seconds: 100 },
        { minuteUtc: "2026-03-11T10:00:00Z", domain: "youtube.com", seconds: 200 },
        { minuteUtc: "2026-03-13T10:00:00Z", domain: "youtube.com", seconds: 300 },
      ],
      "UTC",
      "2026-03-14",
    );
    // 100 + 200 + 300 = 600
    expect(w.topSites).toHaveLength(1);
    expect(w.topSites[0]).toMatchObject({ domain: "youtube.com", seconds: 600 });
  });
});

describe("Day timeline", () => {
  it("Dominant category per minute", () => {
    const slots = buildTimeline(
      [{ minuteUtc: "2026-03-10T10:00:00Z", domains: ["youtube.com", "khanacademy.org"], seconds: [40, 20] }],
      "UTC",
      "2026-03-10",
    );
    expect(slots).toHaveLength(1);
    expect(slots[0]!.category).toBe("entertainment"); // 40 s > 20 s
  });

  it("Minute of day is local", () => {
    const slots = buildTimeline(
      [{ minuteUtc: "2026-03-10T01:05:00Z", domains: ["youtube.com"], seconds: [30] }],
      HCM,
      "2026-03-10",
    );
    expect(slots).toHaveLength(1);
    expect(slots[0]!.minuteOfDay).toBe(485); // 01:05Z + 7 h = 08:05 = 8*60 + 5
  });
});

describe("Usage categories use family overrides", () => {
  it("Override changes the category breakdown", () => {
    const s = summarizeDay([{ domain: "youtube.com", seconds: 600 }], { "youtube.com": "education" });
    expect(s.byCategory.education).toBe(600);
    expect(s.byCategory.entertainment).toBe(0);
    const w = summarizeWeek(
      [{ minuteUtc: "2026-03-10T09:00:00Z", domain: "youtube.com", seconds: 60 }],
      "UTC",
      "2026-03-14",
      { "youtube.com": "games" },
    );
    expect(w.days[2]!.byCategory.games).toBe(60);
    expect(w.days[2]!.byCategory.entertainment).toBe(0);
    const slots = buildTimeline(
      [{ minuteUtc: "2026-03-10T10:00:00Z", domains: ["youtube.com"], seconds: [30] }],
      "UTC",
      "2026-03-10",
      { "youtube.com": "social" },
    );
    expect(slots[0]!.category).toBe("social");
  });
});

describe("Timezone parameter", () => {
  it("Valid timezone", () => {
    expect(resolveTimezone("Asia/Ho_Chi_Minh")).toBe("Asia/Ho_Chi_Minh");
  });

  it("Invalid or missing timezone", () => {
    expect(resolveTimezone("Mars/Base")).toBe("UTC");
    expect(resolveTimezone(undefined)).toBe("UTC");
    expect(resolveTimezone(null)).toBe("UTC");
    expect(resolveTimezone("")).toBe("UTC");
  });
});
