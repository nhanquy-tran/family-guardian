import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, type Db } from "./harness";

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

const TZ = "Asia/Ho_Chi_Minh";

async function child(db: Db, label: string, timezone?: string) {
  const { userId, familyId } = await createUser(db, `Parent ${label}`);
  if (timezone) await db.query("update families set timezone = $1 where id = $2", [timezone, familyId]);
  const id = await scalar<string>(db, "insert into children (family_id, name) values ($1, $2) returning id", [familyId, label]);
  return { userId, id };
}

async function device(db: Db, childId: string, label: string) {
  return scalar<string>(
    db,
    "insert into devices (child_id, token_hash, browser, os) values ($1, $2, 'chrome', 'Windows') returning id",
    [childId, `hash-${label}-${childId}`],
  );
}

// `count` rows of `seconds` each, from `fromMin` minutes after today's local midnight in `tz` (negative = yesterday).
// The service clock cannot be faked in PGlite, so every instant is relative to the real "today" in that timezone.
async function put(db: Db, dev: string, domain: string, tz: string, fromMin: number, count: number, seconds = 60) {
  await db.query(
    `insert into usage_minutes (device_id, minute_utc, domain, seconds)
     select $1::uuid, (date_trunc('day', now() at time zone $3) at time zone $3) + (($4::int + i) * interval '1 minute'), $2, $5::int
     from generate_series(0, $6::int - 1) i`,
    [dev, domain, tz, fromMin, seconds, count],
  );
}

const call = (dev: string) => ({
  sql: "select day::text as day, domain, seconds::int as seconds from public.device_other_usage($1::uuid)",
  params: [dev],
});

async function run(db: Db, dev: string) {
  const q = call(dev);
  const r = await attempt(db, "service", q.sql, q.params);
  if (!r.ok) throw new Error(r.message);
  return r.rows as { day: string; domain: string | null; seconds: number }[];
}

describe("device_other_usage", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createDb();
  });

  it("Excludes the calling device and sums the others in the family timezone", async () => {
    const c = await child(db, "A", TZ);
    const a = await device(db, c.id, "a");
    const b = await device(db, c.id, "b");
    const cc = await device(db, c.id, "c");
    const other = await child(db, "X", TZ);
    const x = await device(db, other.id, "x");
    await put(db, a, "roblox.com", TZ, 0, 2); // 2 * 60 = 120 s on A
    await put(db, b, "roblox.com", TZ, 0, 5); // 5 * 60 = 300 s on B
    await put(db, cc, "roblox.com", TZ, 0, 1); // 60 s on C
    await put(db, b, "roblox.com", TZ, -9, 9); // yesterday, 9 * 60 = 540 s
    await put(db, x, "roblox.com", TZ, 0, 15); // other child, 900 s
    const today = await scalar<string>(db, "select (now() at time zone $1)::date::text", [TZ]);
    const rows = await run(db, a);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.day === today)).toBe(true);
    // B 300 + C 60 = 360, nothing from A, yesterday or the other child
    expect(rows.filter((r) => r.domain === "roblox.com")).toEqual([{ day: today, domain: "roblox.com", seconds: 360 }]);
  });

  it("Day rollover in the family timezone", async () => {
    const c = await child(db, "R", TZ);
    const a = await device(db, c.id, "a");
    const b = await device(db, c.id, "b");
    // the minute before local midnight belongs to yesterday, the first local minute (30 s) to today
    await put(db, b, "roblox.com", TZ, -1, 1, 60);
    await put(db, b, "roblox.com", TZ, 0, 1, 30);
    const today = await scalar<string>(db, "select (now() at time zone $1)::date::text", [TZ]);
    expect(await run(db, a)).toEqual([{ day: today, domain: "roblox.com", seconds: 30 }]);
  });

  it("Defaults and caps", async () => {
    const c = await child(db, "D");
    const a = await device(db, c.id, "a");
    const b = await device(db, c.id, "b");
    const utcToday = await scalar<string>(db, "select (now() at time zone 'UTC')::date::text");
    await db.query(
      `insert into usage_minutes (device_id, minute_utc, domain, seconds)
       select $1::uuid, date_trunc('day', now() at time zone 'UTC') at time zone 'UTC', 'd' || i || '.com', (i % 60) + 1
       from generate_series(0, 1199) i`,
      [b],
    );
    const rows = await run(db, a);
    expect(rows.length).toBeLessThanOrEqual(1000);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.day === utcToday)).toBe(true);
    const secs = rows.map((r) => r.seconds);
    expect(secs).toEqual([...secs].sort((x, y) => y - x));
    expect(secs[0]).toBe(60);

    const empty = await child(db, "E");
    const ea = await device(db, empty.id, "a");
    await device(db, empty.id, "b");
    expect(await run(db, ea)).toEqual([{ day: utcToday, domain: null, seconds: 0 }]);
  });

  it("Permissions", async () => {
    const c = await child(db, "P");
    const a = await device(db, c.id, "a");
    const q = call(a);
    expect((await attempt(db, "anon", q.sql, q.params)).ok).toBe(false);
    expect((await attempt(db, { parent: c.userId }, q.sql, q.params)).ok).toBe(false);
    expect((await attempt(db, "service", q.sql, q.params)).ok).toBe(true);
  });
});
