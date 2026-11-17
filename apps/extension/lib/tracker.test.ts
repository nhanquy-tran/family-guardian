import { UsageEntry } from "@fg/shared";
import { describe, expect, it } from "vitest";
import {
  applyEvent,
  createTracker,
  takeCompletedEntries,
  type IdleState,
  type TrackerEvent,
  type TrackerState,
} from "./tracker";

const T = Date.parse("2026-11-17T10:00:00.000Z");
const S = 1000;
const H = 3600 * S;
const M10 = "2026-11-17T10:00:00.000Z";
const M11 = "2026-11-17T10:01:00.000Z";
const M13 = "2026-11-17T13:00:00.000Z";

const YT = "https://www.youtube.com/watch?v=abc";
const EX = "https://example.com/";

const tab = (at: number, url: string | null): TrackerEvent => ({ type: "tab", at, url });
const focus = (at: number, focused: boolean): TrackerEvent => ({ type: "focus", at, focused });
const idle = (at: number, state: IdleState): TrackerEvent => ({ type: "idle", at, state });
const tick = (at: number): TrackerEvent => ({ type: "tick", at });

function run(events: TrackerEvent[], state: TrackerState = createTracker()): TrackerState {
  return events.reduce(applyEvent, state);
}

function take(state: TrackerState, now: number) {
  const result = takeCompletedEntries(state, now);
  for (const e of result.entries) {
    expect(() => UsageEntry.parse(e)).not.toThrow();
    expect(Object.keys(e).sort()).toEqual(["domain", "minuteUtc", "seconds"]);
  }
  return result;
}

const focusedOn = (url: string, at = T) => run([focus(at, true), tab(at, url)]);

describe("tracker", () => {
  it("fresh tracker counts nothing", () => {
    const s = run([tick(T), tick(T + 30 * S)]);
    expect(take(s, T + 60 * S).entries).toEqual([]);
  });

  it("state survives a JSON round trip", () => {
    const s = focusedOn(YT);
    const restored = JSON.parse(JSON.stringify(s)) as TrackerState;
    const next = applyEvent(restored, tick(T + 60 * S));
    expect(take(next, T + 60 * S).entries).toEqual([{ minuteUtc: M10, domain: "youtube.com", seconds: 60 }]);
  });

  describe("seconds count only while focused, active and on http(s)", () => {
    it("active focused http(s) tab is counted", () => {
      const s = run([tick(T + 40 * S), tick(T + 60 * S)], focusedOn(YT));
      expect(take(s, T + 60 * S).entries).toEqual([{ minuteUtc: M10, domain: "youtube.com", seconds: 60 }]);
    });

    it("window focus lost stops counting", () => {
      const s = run([focus(T + 20 * S, false), tick(T + 60 * S)], focusedOn(EX));
      expect(take(s, T + 60 * S).entries).toEqual([{ minuteUtc: M10, domain: "example.com", seconds: 20 }]);
    });

    it("window focus regained resumes counting", () => {
      const s = run([tab(T, EX), focus(T, false), focus(T + 45 * S, true), tick(T + 60 * S)]);
      expect(take(s, T + 60 * S).entries).toEqual([{ minuteUtc: M10, domain: "example.com", seconds: 15 }]);
    });

    it("idle or locked stops counting", () => {
      const s = run(
        [idle(T + 10 * S, "idle"), idle(T + 30 * S, "active"), idle(T + 50 * S, "locked"), tick(T + 60 * S)],
        focusedOn(EX),
      );
      expect(take(s, T + 60 * S).entries).toEqual([{ minuteUtc: M10, domain: "example.com", seconds: 30 }]);
    });

    it("non-web tabs are not counted", () => {
      const s = run([
        focus(T, true),
        tab(T, "chrome://extensions"),
        tab(T + 20 * S, "file:///C:/x.html"),
        tab(T + 40 * S, null),
        tick(T + 60 * S),
      ]);
      expect(take(s, T + 60 * S).entries).toEqual([]);
    });
  });

  describe("registrable domain attribution", () => {
    it("tab switch splits time between domains", () => {
      const s = run([tab(T + 25 * S, "https://docs.google.com/document/d/1"), tick(T + 60 * S)], focusedOn(YT));
      expect(take(s, T + 60 * S).entries).toEqual([
        { minuteUtc: M10, domain: "google.com", seconds: 35 },
        { minuteUtc: M10, domain: "youtube.com", seconds: 25 },
      ]);
    });

    it("subdomains are merged into one entry", () => {
      const s = run([tab(T + 30 * S, "https://www.facebook.com/b"), tick(T + 60 * S)], focusedOn("https://m.facebook.com/a"));
      expect(take(s, T + 60 * S).entries).toEqual([{ minuteUtc: M10, domain: "facebook.com", seconds: 60 }]);
    });
  });

  describe("minute boundaries", () => {
    it("interval crossing a minute boundary is split", () => {
      const s = run([tick(T + 70 * S), tick(T + 120 * S)], focusedOn(EX, T + 50 * S));
      expect(take(s, T + 120 * S).entries).toEqual([
        { minuteUtc: M10, domain: "example.com", seconds: 10 },
        { minuteUtc: M11, domain: "example.com", seconds: 60 },
      ]);
    });
  });

  describe("completed minutes only", () => {
    it("current minute is kept until it ends", () => {
      const s = run([tick(T + 30 * S)], focusedOn(EX));
      const first = take(s, T + 30 * S);
      expect(first.entries).toEqual([]);
      const later = applyEvent(first.state, tick(T + 60 * S));
      expect(take(later, T + 60 * S).entries).toEqual([{ minuteUtc: M10, domain: "example.com", seconds: 60 }]);
    });

    it("entries are returned only once", () => {
      const s = run([tick(T + 60 * S)], focusedOn(EX));
      const first = take(s, T + 60 * S);
      expect(first.entries).toHaveLength(1);
      expect(take(first.state, T + 60 * S).entries).toEqual([]);
    });

    it("fractions are rounded down and zero entries omitted", () => {
      const s = run(
        [tab(T + 400, "https://b.com/"), tab(T + 30900, "https://c.com/"), tick(T + 60 * S)],
        focusedOn("https://a.com/"),
      );
      const { entries } = take(s, T + 60 * S);
      expect(entries).toContainEqual({ minuteUtc: M10, domain: "b.com", seconds: 30 });
      expect(entries).toContainEqual({ minuteUtc: M10, domain: "c.com", seconds: 29 });
      expect(entries.find((e) => e.domain === "a.com")).toBeUndefined();
    });
  });

  describe("60 seconds per minute cap", () => {
    it("rapid switching within one minute stays within 60", () => {
      const events: TrackerEvent[] = [];
      for (let i = 1; i <= 85; i++) {
        events.push(tab(T + Math.round(i * 0.7 * S), i % 2 ? "https://b.com/" : "https://a.com/"));
      }
      events.push(tick(T + 60 * S));
      const s = run(events, run([focus(T, true), tab(T, "https://a.com/")]));
      const { entries } = take(s, T + 60 * S);
      const total = entries.filter((e) => e.minuteUtc === M10).reduce((n, e) => n + e.seconds, 0);
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThanOrEqual(60);
    });

    it("duplicate events do not double count", () => {
      const s = run([tick(T + 30 * S), tick(T + 30 * S), tab(T + 30 * S, EX), tick(T + 60 * S)], focusedOn(EX));
      expect(take(s, T + 60 * S).entries).toEqual([{ minuteUtc: M10, domain: "example.com", seconds: 60 }]);
    });
  });

  describe("sleep, long gaps and clock jumps", () => {
    it("laptop sleeps for hours", () => {
      const s = run([tick(T + 60 * S), tick(T + 3 * H), tick(T + 3 * H + 60 * S)], focusedOn(EX));
      expect(take(s, T + 3 * H + 60 * S).entries).toEqual([
        { minuteUtc: M10, domain: "example.com", seconds: 60 },
        { minuteUtc: M13, domain: "example.com", seconds: 60 },
      ]);
    });

    it("gap of exactly 120 seconds is still counted", () => {
      const s = run([tick(T + 120 * S)], focusedOn(EX));
      expect(take(s, T + 120 * S).entries).toEqual([
        { minuteUtc: M10, domain: "example.com", seconds: 60 },
        { minuteUtc: M11, domain: "example.com", seconds: 60 },
      ]);
    });

    it("clock moves backwards", () => {
      const s = run([tick(T + 50 * S), tick(T + 20 * S), tick(T + 60 * S)], focusedOn(EX));
      expect(take(s, T + 60 * S).entries).toEqual([{ minuteUtc: M10, domain: "example.com", seconds: 60 }]);
    });
  });

  describe("privacy (ADR 0005)", () => {
    it("state and output contain only the domain", () => {
      const s = run([
        focus(T, true),
        tab(T, "https://www.youtube.com/watch?v=secret123#t=5"),
        tick(T + 60 * S),
      ]);
      const stateJson = JSON.stringify(s);
      const { entries } = take(s, T + 60 * S);
      const entriesJson = JSON.stringify(entries);
      for (const json of [stateJson, entriesJson]) {
        expect(json).toContain("youtube.com");
        for (const banned of ["watch", "secret123", "#t=5", "https://", "www.youtube.com"]) {
          expect(json).not.toContain(banned);
        }
      }
    });
  });
});
