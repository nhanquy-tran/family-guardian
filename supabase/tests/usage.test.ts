import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, type Db } from "./harness";

const INSUFFICIENT_PRIVILEGE = "42501";

type Fam = { userId: string; child: string; device: string };

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

async function seed(db: Db, label: string): Promise<Fam> {
  const { userId, familyId } = await createUser(db, `Parent ${label}`);
  const child = await scalar<string>(db, "insert into children (family_id, name) values ($1, $2) returning id", [familyId, label]);
  const device = await scalar<string>(
    db,
    "insert into devices (child_id, token_hash, browser, os) values ($1, $2, 'chrome', 'Windows') returning id",
    [child, `hash-${label}-${userId}`],
  );
  return { userId, child, device };
}

const byDay = (child: string, tz: string, days: number) => ({
  sql: "select day::text as day, domain, seconds::int as seconds from public.usage_by_day($1::uuid, $2, $3)",
  params: [child, tz, days],
});
const timeline = (child: string, tz: string, day: string) => ({
  sql: "select minute_of_day, domains, seconds from public.usage_timeline($1::uuid, $2, $3::date) order by minute_of_day",
  params: [child, tz, day],
});

describe("usage aggregation functions", () => {
  let db: Db;
  let a: Fam;
  let b: Fam;

  beforeAll(async () => {
    db = await createDb();
    a = await seed(db, "A");
    b = await seed(db, "B");
  });

  it("Week with more than 1000 rows sums correctly", async () => {
    // 2500 rows, one every 4 minutes from 6 UTC days before today: 2499 * 4 = 9996 min < 7 days
    await db.query(
      `insert into usage_minutes (device_id, minute_utc, domain, seconds)
       select $1::uuid,
              date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' - interval '6 days' + (i * 4) * interval '1 minute',
              'd' || (i % 5) || '.com',
              (i % 60) + 1
       from generate_series(0, 2499) i`,
      [a.device],
    );
    expect(await scalar<number>(db, "select count(*)::int from usage_minutes where device_id = $1", [a.device])).toBe(2500);

    const expected = await db.query<{ domain: string; seconds: number }>(
      "select domain, sum(seconds)::int as seconds from usage_minutes where device_id = $1 group by domain order by domain",
      [a.device],
    );
    const q = byDay(a.child, "UTC", 7);
    const r = await attempt(db, { parent: a.userId }, q.sql, q.params);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const got = new Map<string, number>();
    for (const row of r.rows) got.set(row.domain as string, (got.get(row.domain as string) ?? 0) + (row.seconds as number));
    expect([...got.entries()].sort()).toEqual(expected.rows.map((x) => [x.domain, x.seconds]).sort());
    expect(r.rows.length).toBeLessThanOrEqual(7 * 5); // at most days x distinct domains
  });

  it("Days split by timezone in SQL", async () => {
    // yesterday 18:30Z is 01:30 on today's UTC date at UTC+7
    const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const f = await seed(db, "TZ");
    await db.query("insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, $2, 'youtube.com', 30)", [
      f.device,
      `${day(-1)}T18:30:00Z`,
    ]);
    const q = byDay(f.child, "Asia/Ho_Chi_Minh", 7);
    const r = await attempt(db, { parent: f.userId }, q.sql, q.params);
    expect(r.ok && r.rows).toEqual([{ day: day(0), domain: "youtube.com", seconds: 30 }]);
  });

  it("Timeline returns one row per minute", async () => {
    const f = await seed(db, "TL");
    // 1440 minutes on 2026-03-10 with a.com (30 s); every third minute also has b.com (20 s)
    await db.query(
      `insert into usage_minutes (device_id, minute_utc, domain, seconds)
       select $1::uuid, timestamptz '2026-03-10 00:00+00' + i * interval '1 minute', 'a.com', 30 from generate_series(0, 1439) i`,
      [f.device],
    );
    await db.query(
      `insert into usage_minutes (device_id, minute_utc, domain, seconds)
       select $1::uuid, timestamptz '2026-03-10 00:00+00' + i * interval '1 minute', 'b.com', 20 from generate_series(0, 1439, 3) i`,
      [f.device],
    );
    const q = timeline(f.child, "UTC", "2026-03-10");
    const r = await attempt(db, { parent: f.userId }, q.sql, q.params);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(1440);
    expect(r.rows.map((x) => x.minute_of_day)).toEqual(Array.from({ length: 1440 }, (_, i) => i));
    const pairs = (row: Record<string, unknown>) =>
      (row.domains as string[]).map((d, i) => [d, (row.seconds as number[])[i]] as const).sort();
    expect(pairs(r.rows[0]!)).toEqual([["a.com", 30], ["b.com", 20]]); // minute 0: i % 3 = 0
    expect(pairs(r.rows[1]!)).toEqual([["a.com", 30]]);
  });

  it("Other family's child", async () => {
    await db.query("insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, date_trunc('minute', now()), 'x.com', 5)", [b.device]);
    const qd = byDay(b.child, "UTC", 7);
    const qt = timeline(b.child, "UTC", "2026-03-10");
    const d = await attempt(db, { parent: a.userId }, qd.sql, qd.params);
    const t = await attempt(db, { parent: a.userId }, qt.sql, qt.params);
    expect(d.ok && d.rows).toEqual([]);
    expect(t.ok && t.rows).toEqual([]);
  });

  it("Invalid timezone", async () => {
    for (const q of [byDay(a.child, "Mars/Base", 7), timeline(a.child, "Mars/Base", "2026-03-10")]) {
      const r = await attempt(db, { parent: a.userId }, q.sql, q.params);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toContain("invalid_timezone");
    }
  });

  it("Days out of range", async () => {
    const valid = byDay(a.child, "UTC", 31);
    expect((await attempt(db, { parent: a.userId }, valid.sql, valid.params)).ok).toBe(true); // 31 is the upper bound
    for (const days of [0, 32]) {
      const q = byDay(a.child, "UTC", days);
      const r = await attempt(db, { parent: a.userId }, q.sql, q.params);
      expect(r.ok, `days ${days}`).toBe(false);
    }
  });

  it("Anonymous caller", async () => {
    for (const q of [byDay(a.child, "UTC", 7), timeline(a.child, "UTC", "2026-03-10")]) {
      const r = await attempt(db, "anon", q.sql, q.params);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe(INSUFFICIENT_PRIVILEGE);
    }
  });
});
