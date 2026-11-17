import { describe, expect, it } from "vitest";
import type { UsageEntry } from "./contracts";
import { computeFocusScore } from "./focus";

const HW = "khanacademy.org";
const OTHER = "youtube.com";
const HOMEWORK = [HW];

function minute(hour: number, min: number): string {
  const hh = String(hour).padStart(2, "0");
  const mm = String(min).padStart(2, "0");
  return `2026-11-17T${hh}:${mm}:00.000Z`;
}

function entry(min: number, domain: string, seconds = 60, hour = 8): UsageEntry {
  return { minuteUtc: minute(hour, min), domain, seconds };
}

function range(from: number, to: number, domain: string): UsageEntry[] {
  const out: UsageEntry[] = [];
  for (let m = from; m <= to; m++) out.push(entry(m, domain));
  return out;
}

describe("computeFocusScore", () => {
  it("only homework", () => {
    expect(computeFocusScore(range(0, 29, HW), HOMEWORK)).toEqual({
      score: 100,
      homeworkSeconds: 1800,
      totalSeconds: 1800,
      switches: 0,
    });
  });

  it("empty homework list", () => {
    expect(computeFocusScore(range(0, 9, HW), [])).toEqual({
      score: 0,
      homeworkSeconds: 0,
      totalSeconds: 600,
      switches: 0,
    });
  });

  it("no entries", () => {
    expect(computeFocusScore([], HOMEWORK)).toEqual({
      score: null,
      homeworkSeconds: 0,
      totalSeconds: 0,
      switches: 0,
    });
  });

  it("mixed minute is classified by majority seconds", () => {
    const entries = [entry(0, HW, 40), entry(0, OTHER, 20), entry(1, OTHER, 60)];
    expect(computeFocusScore(entries, HOMEWORK)).toEqual({
      score: 13,
      homeworkSeconds: 40,
      totalSeconds: 120,
      switches: 1,
    });
  });

  it("tied minute counts as homework", () => {
    const entries = [entry(0, HW, 30), entry(0, OTHER, 30), entry(1, HW, 60)];
    expect(computeFocusScore(entries, HOMEWORK)).toEqual({
      score: 75,
      homeworkSeconds: 90,
      totalSeconds: 120,
      switches: 0,
    });
  });

  it("unordered input gives the same result", () => {
    const ordered = [...range(0, 9, HW), ...range(10, 19, OTHER)];
    const reversed = [...ordered].reverse();
    const expected = computeFocusScore(ordered, HOMEWORK);
    expect(computeFocusScore(reversed, HOMEWORK)).toEqual(expected);
  });

  it("one switch in one session", () => {
    const entries = [...range(0, 9, HW), ...range(10, 19, OTHER)];
    expect(computeFocusScore(entries, HOMEWORK)).toEqual({
      score: 44,
      homeworkSeconds: 600,
      totalSeconds: 1200,
      switches: 1,
    });
  });

  it("gap over 5 minutes starts a new session", () => {
    const result = computeFocusScore([entry(0, HW), entry(6, OTHER)], HOMEWORK);
    expect(result.switches).toBe(0);
    expect(result.score).toBe(50);
  });

  it("gap of exactly 5 minutes stays in the session", () => {
    const result = computeFocusScore([entry(0, HW), entry(5, OTHER)], HOMEWORK);
    expect(result.switches).toBe(1);
    expect(result.score).toBe(30);
  });

  it("penalty is capped at 20", () => {
    const entries: UsageEntry[] = [];
    for (let m = 0; m < 60; m++) entries.push(entry(m, m % 2 === 0 ? HW : OTHER));
    expect(computeFocusScore(entries, HOMEWORK)).toEqual({
      score: 30,
      homeworkSeconds: 1800,
      totalSeconds: 3600,
      switches: 59,
    });
  });

  it("negative score is clamped to 0", () => {
    const result = computeFocusScore([entry(0, HW, 6), entry(1, OTHER, 60)], HOMEWORK);
    expect(result.switches).toBe(1);
    expect(result.score).toBe(0);
    expect(Object.is(result.score, 0)).toBe(true);
  });
});
