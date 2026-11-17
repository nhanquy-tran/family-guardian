import { describe, expect, it } from "vitest";
import { lastSlot, parseCron } from "./revive-schedules.mjs";

const at = (iso) => Date.parse(iso);
const iso = (ms) => new Date(ms).toISOString();

describe("parseCron", () => {
  it("reads a twice-hourly cron", () => {
    expect(parseCron('    - cron: "26,56 * * * *" # comment')).toEqual({ minutes: [26, 56], hours: null });
  });

  it("reads a daily cron", () => {
    expect(parseCron('cron: "13 15 * * *"')).toEqual({ minutes: [13], hours: [15] });
  });

  it("returns null for shapes it does not support", () => {
    expect(parseCron('cron: "*/30 * * * *"')).toBeNull();
    expect(parseCron('cron: "17 3 * * 1"')).toBeNull();
    expect(parseCron("on: push")).toBeNull();
  });
});

describe("lastSlot", () => {
  const twiceHourly = { minutes: [26, 56], hours: null };
  const daily = { minutes: [13], hours: [15] };

  it("finds the last twice-hourly slot older than the 30-minute grace", () => {
    expect(iso(lastSlot(twiceHourly, at("2026-11-17T18:10:00Z")))).toBe("2026-11-17T17:26:00.000Z");
  });

  it("counts a slot exactly at the grace boundary as due", () => {
    expect(iso(lastSlot(twiceHourly, at("2026-11-17T18:26:00Z")))).toBe("2026-11-17T17:56:00.000Z");
  });

  it("uses today's daily slot once the grace has passed", () => {
    expect(iso(lastSlot(daily, at("2026-11-17T16:00:00Z")))).toBe("2026-11-17T15:13:00.000Z");
  });

  it("uses yesterday's daily slot before today's slot plus grace", () => {
    expect(iso(lastSlot(daily, at("2026-11-17T15:30:00Z")))).toBe("2026-11-16T15:13:00.000Z");
  });

  it("rolls back over midnight", () => {
    expect(iso(lastSlot({ minutes: [47], hours: [2] }, at("2026-11-18T01:00:00Z")))).toBe("2026-11-17T02:47:00.000Z");
  });

  it("treats a workflow with no runs as having missed the slot", () => {
    const slot = lastSlot(daily, at("2026-11-17T16:00:00Z"));
    expect(0 >= slot).toBe(false);
  });
});
