import { describe, expect, it } from "vitest";
import { enqueue, parseQueue, pruneQueue } from "./queue";
import { NOW } from "./test-fakes";

const e = (iso: string, domain: string) => ({ minuteUtc: iso, domain, seconds: 30 });

describe("queue", () => {
  it("oldest first", () => {
    const result = enqueue(
      [e("2026-11-17T10:03:00.000Z", "youtube.com")],
      [
        e("2026-11-17T10:04:00.000Z", "a.com"),
        e("2026-11-17T10:02:00.000Z", "b.com"),
        e("2026-11-17T10:03:00.000Z", "khanacademy.org"),
      ],
      NOW,
    );
    expect(result.map((x) => `${x.minuteUtc.slice(11, 16)} ${x.domain}`)).toEqual([
      "10:02 b.com",
      "10:03 khanacademy.org",
      "10:03 youtube.com",
      "10:04 a.com",
    ]);
  });

  it("seven-day limit", () => {
    const old = e("2026-11-10T10:04:00.000Z", "a.com");
    const edge = e("2026-11-10T10:05:00.000Z", "a.com");
    const recent = e("2026-11-17T10:04:00.000Z", "a.com");
    expect(pruneQueue([old, edge, recent], NOW)).toEqual([edge, recent]);
  });

  it("corrupt stored queue", () => {
    const valid = e("2026-11-17T10:04:00.000Z", "a.com");
    expect(parseQueue(undefined)).toEqual([]);
    expect(parseQueue("x")).toEqual([]);
    expect(parseQueue({})).toEqual([]);
    expect(parseQueue([null, { domain: "a.com" }, valid])).toEqual([valid]);
  });
});
