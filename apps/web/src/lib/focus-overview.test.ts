import { computeFocusScore } from "@fg/shared";
import { describe, expect, it, vi } from "vitest";
import { loadFocusOverview, type ChildFocus, type FocusOverview } from "./focus-overview";

type Client = Parameters<typeof loadFocusOverview>[0];
type Result = { data: unknown; error: unknown };
type UsageCall = { deviceIds: string[]; from: number; to: number };
type UsageRow = { minute_utc: string; domain: string; seconds: number };

const NOW = new Date("2026-03-14T12:00:00Z");
const DB_ERROR = { code: "XX000", message: "secret-db-failure-text" };
const ok = (data: unknown): Result => ({ data, error: null });

const childRow = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `Name ${id}`,
  homework_categories: ["education"],
  homework_domains: [],
  ...over,
});

/** A usage row for `domain` at `hh:mm` UTC on `day`, in the format PostgREST returns. */
const row = (day: string, hhmm: string, domain: string, seconds = 60): UsageRow => ({
  minute_utc: `${day}T${hhmm}:00+00:00`,
  domain,
  seconds,
});

/** `count` consecutive minutes starting at 10:00 on `day`. */
const minutes = (day: string, count: number, domain: string, startMinute = 0): UsageRow[] =>
  Array.from({ length: count }, (_, i) => {
    const m = startMinute + i;
    return row(day, `${String(10 + Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, domain);
  });

/**
 * Fake Supabase client. children() and devices (by eq("child_id", id)) resolve when awaited; a usage_minutes read
 * must end in .range(from, to) and is answered by `usage(call)`. A usage read without .range() returns an error.
 */
function fakeClient(opts: { children: Result; devices?: Record<string, Result>; usage?: (call: UsageCall) => Result }) {
  const usageCalls: UsageCall[] = [];
  const tables: string[] = [];
  const from = vi.fn((table: string) => {
    tables.push(table);
    const ops: [string, unknown[]][] = [];
    const arg = (method: string) => ops.find(([m]) => m === method)?.[1];
    const chain: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown, reject?: (e: unknown) => unknown) => {
        let r: Result = { data: null, error: { message: "unexpected query" } };
        if (table === "children") r = opts.children;
        if (table === "devices") r = opts.devices?.[String(arg("eq")?.[1])] ?? ok([]);
        return Promise.resolve(r).then(resolve, reject);
      },
    };
    for (const method of ["select", "eq", "in", "gte", "gt", "lt", "lte", "order", "limit"]) {
      chain[method] = (...args: unknown[]) => {
        ops.push([method, args]);
        return chain;
      };
    }
    chain.range = (a: number, b: number) => {
      const ids = (arg("in")?.[1] as string[] | undefined) ?? [];
      const call = { deviceIds: ids, from: a, to: b };
      usageCalls.push(call);
      return Promise.resolve(opts.usage ? opts.usage(call) : ok([]));
    };
    return chain;
  });
  return { client: { from } as unknown as Client, usageCalls, tables };
}

/** Serves `rows` in pages of 1000 according to the requested range. */
const paged = (rows: UsageRow[]) => (c: UsageCall) => ok(rows.slice(c.from, c.to + 1));

function onlyChild(overview: FocusOverview): ChildFocus {
  expect(overview.status).toBe("ok");
  if (overview.status !== "ok") throw new Error("overview failed");
  expect(overview.children).toHaveLength(1);
  return overview.children[0] as ChildFocus;
}

function data(child: ChildFocus) {
  expect("today" in child.result, `${child.id} has data`).toBe(true);
  if (!("today" in child.result)) throw new Error("child has no data");
  return child.result;
}

describe("loadFocusOverview", () => {
  it("Today and trend", async () => {
    const today = [...minutes("2026-03-14", 10, "khanacademy.org"), ...minutes("2026-03-14", 10, "youtube.com", 10)];
    const yesterday = minutes("2026-03-13", 10, "khanacademy.org");
    const f = fakeClient({
      children: ok([childRow("c1")]),
      devices: { c1: ok([{ id: "dev-1" }]) },
      usage: paged([...yesterday, ...today]),
    });
    const child = onlyChild(await loadFocusOverview(f.client, "UTC", NOW));
    const result = data(child);

    // 10 homework minutes then 10 other minutes: 600 s each, one switch; the score comes from the formula itself
    const expected = computeFocusScore(
      [...today].map((r) => ({ minuteUtc: r.minute_utc, domain: r.domain, seconds: r.seconds })),
      ["khanacademy.org"],
    );
    expect(result.today).toEqual({ ...expected, otherSeconds: 600 });
    expect(result.today.homeworkSeconds).toBe(600);
    expect(result.today.switches).toBe(1);
    expect(result.today.score).not.toBeNull();

    // 7 local days ending today (2026-03-14): 03-08 .. 03-14
    expect(result.trend.map((d) => d.day)).toEqual([
      "2026-03-08", "2026-03-09", "2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14",
    ]);
    expect(result.trend[6]?.score).toBe(expected.score);
    expect(result.trend[5]?.score).toBe(100); // yesterday: only homework minutes, no switches
    expect(result.trend.slice(0, 5).map((d) => d.score)).toEqual([null, null, null, null, null]);
  });

  it("Settings drive homework", async () => {
    const rows = [row("2026-03-14", "10:00", "youtube.com"), row("2026-03-14", "10:01", "khanacademy.org")];
    const f = fakeClient({
      children: ok([childRow("c1", { homework_domains: ["youtube.com"], homework_categories: ["education"] })]),
      devices: { c1: ok([{ id: "dev-1" }]) },
      usage: paged(rows),
    });
    const result = data(onlyChild(await loadFocusOverview(f.client, "UTC", NOW)));
    expect(result.today.homeworkSeconds).toBe(120);
    expect(result.today.otherSeconds).toBe(0);
  });

  it("Day boundary uses the timezone", async () => {
    // 2026-03-13T23:30Z is 06:30 on 2026-03-14 in UTC+7
    const f = fakeClient({
      children: ok([childRow("c1")]),
      devices: { c1: ok([{ id: "dev-1" }]) },
      usage: paged([row("2026-03-13", "23:30", "khanacademy.org")]),
    });
    const result = data(onlyChild(await loadFocusOverview(f.client, "Asia/Ho_Chi_Minh", NOW)));
    expect(result.today.homeworkSeconds).toBe(60);
    expect(result.trend[6]?.score).not.toBeNull();
    expect(result.trend[5]?.score).toBeNull();
  });

  it("More than 1000 rows", async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => row("2026-03-14", "10:00", `site${i}.com`, 1));
    const f = fakeClient({
      children: ok([childRow("c1")]),
      devices: { c1: ok([{ id: "dev-1" }]) },
      usage: paged(rows),
    });
    const result = data(onlyChild(await loadFocusOverview(f.client, "UTC", NOW)));
    expect(result.today.totalSeconds).toBe(1500);
    expect(result.today.otherSeconds).toBe(1500); // 1500 rows of 1 s, none homework
    expect(f.usageCalls.map((c) => [c.from, c.to])).toEqual([[0, 999], [1000, 1999]]);
  });

  it("Page cap fails visibly", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => row("2026-03-14", "10:00", `site${i}.com`, 1));
    const f = fakeClient({
      children: ok([childRow("c1")]),
      devices: { c1: ok([{ id: "dev-1" }]) },
      usage: () => ok(full),
    });
    const child = onlyChild(await loadFocusOverview(f.client, "UTC", NOW));
    expect("today" in child.result).toBe(false);
    expect(child.result).toEqual({ error: true });
    expect(f.usageCalls).toHaveLength(30);
  });

  it("Child without devices", async () => {
    const f = fakeClient({ children: ok([childRow("c1")]), devices: { c1: ok([]) } });
    const result = data(onlyChild(await loadFocusOverview(f.client, "UTC", NOW)));
    expect(result.today).toEqual({ score: null, homeworkSeconds: 0, totalSeconds: 0, switches: 0, otherSeconds: 0 });
    expect(result.trend).toHaveLength(7);
    expect(f.usageCalls).toHaveLength(0);
    expect(f.tables).not.toContain("usage_minutes");
  });

  it("Failure is per child and never partial", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => row("2026-03-14", "10:00", `site${i}.com`, 1));
    const f = fakeClient({
      children: ok([childRow("c1"), childRow("c2")]),
      devices: { c1: ok([{ id: "dev-1" }]), c2: ok([{ id: "dev-2" }]) },
      usage: (c) => {
        if (c.deviceIds.includes("dev-2")) return ok([row("2026-03-14", "10:00", "khanacademy.org")]);
        return c.from === 0 ? ok(full) : { data: null, error: DB_ERROR };
      },
    });
    const overview = await loadFocusOverview(f.client, "UTC", NOW);
    expect(overview.status).toBe("ok");
    if (overview.status !== "ok") return;
    const [first, second] = overview.children as [ChildFocus, ChildFocus];
    expect(first.result).toEqual({ error: true });
    expect(data(second).today.homeworkSeconds).toBe(60);
  });

  it("Children list failure", async () => {
    const failed = await loadFocusOverview(fakeClient({ children: { data: null, error: DB_ERROR } }).client, "UTC", NOW);
    expect(failed).toEqual({ status: "error" });

    const empty = await loadFocusOverview(fakeClient({ children: ok([]) }).client, "UTC", NOW);
    expect(empty).toEqual({ status: "ok", children: [] });
  });
});
