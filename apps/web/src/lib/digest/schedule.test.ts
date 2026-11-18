import { describe, expect, it } from "vitest";
import { latestDuePeriod, reportPeriod, type DigestFamily } from "./schedule";

const family = (over: Partial<DigestFamily> = {}): DigestFamily => ({
  frequency: "daily",
  hour: 8,
  timezone: "UTC",
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

const at = (iso: string) => new Date(iso);

describe("latestDuePeriod", () => {
  it("Daily around the send time", () => {
    // 2026-11-18T08:00Z is the send moment: the period is the day before, 2026-11-17
    expect(latestDuePeriod(family(), at("2026-11-18T08:00:00Z"))).toEqual({
      frequency: "daily",
      periodStart: "2026-11-17",
      start: "2026-11-17T00:00:00.000Z",
      end: "2026-11-18T00:00:00.000Z",
    });
    // one minute earlier the latest send moment was 2026-11-17 08:00: the period is 2026-11-16
    expect(latestDuePeriod(family(), at("2026-11-18T07:59:00Z"))).toEqual({
      frequency: "daily",
      periodStart: "2026-11-16",
      start: "2026-11-16T00:00:00.000Z",
      end: "2026-11-17T00:00:00.000Z",
    });
  });

  it("Weekly and catch-up", () => {
    // 2026-11-16 is a Monday: the week before is Monday 2026-11-09 to Sunday 2026-11-15, ending 2026-11-16T00:00Z
    const lastWeek = {
      frequency: "weekly",
      periodStart: "2026-11-09",
      start: "2026-11-09T00:00:00.000Z",
      end: "2026-11-16T00:00:00.000Z",
    };
    const weekly = family({ frequency: "weekly" });
    expect(latestDuePeriod(weekly, at("2026-11-16T08:00:00Z"))).toEqual(lastWeek);
    // Wednesday 2026-11-18: the latest Monday 08:00 is still 2026-11-16
    expect(latestDuePeriod(weekly, at("2026-11-18T12:00:00Z"))).toEqual(lastWeek);
    // Monday 07:59 is before the send moment: the latest one was 2026-11-09 08:00, so the week starting 2026-11-02
    expect(latestDuePeriod(weekly, at("2026-11-16T07:59:00Z"))).toEqual({
      frequency: "weekly",
      periodStart: "2026-11-02",
      start: "2026-11-02T00:00:00.000Z",
      end: "2026-11-09T00:00:00.000Z",
    });
  });

  it("Timezone offset", () => {
    // 2026-11-17T23:00Z + 9 h = 2026-11-18 08:00 in Tokyo: the period is the Tokyo day 2026-11-17
    // Tokyo midnight 2026-11-17 = 2026-11-16T15:00Z, the next one = 2026-11-17T15:00Z
    expect(latestDuePeriod(family({ timezone: "Asia/Tokyo" }), at("2026-11-17T23:00:00Z"))).toEqual({
      frequency: "daily",
      periodStart: "2026-11-17",
      start: "2026-11-16T15:00:00.000Z",
      end: "2026-11-17T15:00:00.000Z",
    });
  });

  it("Daylight saving day is one local day long", () => {
    // Europe/Zurich leaves summer time on 2026-10-25 (25 h day). Send moment 2026-10-26 08:00 CET = 07:00Z.
    // Local midnight 2026-10-25 is CEST (UTC+2) = 2026-10-24T22:00Z, midnight 2026-10-26 is CET (UTC+1) = 2026-10-25T23:00Z.
    expect(latestDuePeriod(family({ timezone: "Europe/Zurich" }), at("2026-10-26T07:00:00Z"))).toEqual({
      frequency: "daily",
      periodStart: "2026-10-25",
      start: "2026-10-24T22:00:00.000Z",
      end: "2026-10-25T23:00:00.000Z",
    });
  });

  it("Invalid timezone and new family", () => {
    const now = at("2026-11-18T09:30:00Z");
    // Bad/Zone is computed as UTC: send moment 2026-11-18T08:00Z, period 2026-11-17
    expect(latestDuePeriod(family({ timezone: "Bad/Zone" }), now)).toEqual({
      frequency: "daily",
      periodStart: "2026-11-17",
      start: "2026-11-17T00:00:00.000Z",
      end: "2026-11-18T00:00:00.000Z",
    });
    // created 09:00Z, after the 08:00Z send moment
    expect(latestDuePeriod(family({ createdAt: "2026-11-18T09:00:00Z" }), now)).toBeNull();
  });
});

describe("reportPeriod", () => {
  it("Monday at the send hour and catch-up", () => {
    // daily family: the report is still weekly. Monday 2026-11-16 08:00Z: week 2026-11-09 to 2026-11-16, week before from 2026-11-02
    const lastWeek = {
      frequency: "weekly_report",
      periodStart: "2026-11-09",
      start: "2026-11-09T00:00:00.000Z",
      end: "2026-11-16T00:00:00.000Z",
      prevStart: "2026-11-02T00:00:00.000Z",
    };
    expect(reportPeriod(family(), at("2026-11-16T08:00:00Z"))).toEqual(lastWeek);
    // Wednesday: the latest Monday 08:00 is still 2026-11-16
    expect(reportPeriod(family(), at("2026-11-18T12:00:00Z"))).toEqual(lastWeek);
    // Monday 07:59: latest send moment was 2026-11-09 08:00, so week 2026-11-02 to 2026-11-09, week before from 2026-10-26
    expect(reportPeriod(family(), at("2026-11-16T07:59:00Z"))).toEqual({
      frequency: "weekly_report",
      periodStart: "2026-11-02",
      start: "2026-11-02T00:00:00.000Z",
      end: "2026-11-09T00:00:00.000Z",
      prevStart: "2026-10-26T00:00:00.000Z",
    });
  });

  it("Timezone and new family", () => {
    // 2026-11-15T23:00Z + 9 h = Monday 2026-11-16 08:00 in Tokyo: week 2026-11-09 to 2026-11-16 local
    // Tokyo midnight 11-09 = 11-08T15:00Z, 11-16 = 11-15T15:00Z, 11-02 = 11-01T15:00Z
    const now = at("2026-11-15T23:00:00Z");
    expect(reportPeriod(family({ timezone: "Asia/Tokyo" }), now)).toEqual({
      frequency: "weekly_report",
      periodStart: "2026-11-09",
      start: "2026-11-08T15:00:00.000Z",
      end: "2026-11-15T15:00:00.000Z",
      prevStart: "2026-11-01T15:00:00.000Z",
    });
    // Bad/Zone is UTC: Sunday 23:00Z, latest Monday 08:00Z is 2026-11-09, so week 2026-11-02 to 2026-11-09
    expect(reportPeriod(family({ timezone: "Bad/Zone" }), now)).toMatchObject({
      periodStart: "2026-11-02",
      start: "2026-11-02T00:00:00.000Z",
      end: "2026-11-09T00:00:00.000Z",
    });
    // the Tokyo send moment is 2026-11-15T23:00Z: created 23:30Z is after it
    expect(reportPeriod(family({ timezone: "Asia/Tokyo", createdAt: "2026-11-15T23:30:00Z" }), now)).toBeNull();
  });

  it("Daylight saving change", () => {
    // Zurich left summer time on 2026-10-25. Monday 2026-11-02 08:00 CET = 07:00Z.
    // Week 2026-10-26 00:00 CET = 10-25T23:00Z to 2026-11-02 00:00 CET = 11-01T23:00Z (168 h);
    // week before starts 2026-10-19 00:00 CEST = 10-18T22:00Z (169 h earlier, not start - 7 days)
    expect(reportPeriod(family({ timezone: "Europe/Zurich" }), at("2026-11-02T07:00:00Z"))).toEqual({
      frequency: "weekly_report",
      periodStart: "2026-10-26",
      start: "2026-10-25T23:00:00.000Z",
      end: "2026-11-01T23:00:00.000Z",
      prevStart: "2026-10-18T22:00:00.000Z",
    });
  });
});
