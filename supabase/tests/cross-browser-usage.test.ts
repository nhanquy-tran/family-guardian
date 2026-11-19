import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, type Db } from "./harness";

const TZ = "Asia/Ho_Chi_Minh";

type Fam = { familyId: string; userId: string; child: string; devices: string[] };

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

async function seed(db: Db, label: string, deviceCount = 3): Promise<Fam> {
  const { userId, familyId } = await createUser(db, `Parent ${label}`);
  const child = await scalar<string>(db, "insert into children (family_id, name) values ($1, $2) returning id", [familyId, label]);
  const devices: string[] = [];
  for (let i = 0; i < deviceCount; i++) {
    devices.push(
      await scalar<string>(
        db,
        "insert into devices (child_id, token_hash, browser, os) values ($1, $2, 'chrome', 'Windows') returning id",
        [child, `hash-${label}-${i}-${userId}`],
      ),
    );
  }
  return { familyId, userId, child, devices };
}

/** `count` rows of `seconds` each, one per minute, starting `startMinute` minutes after local midnight of `tz` (negative = yesterday). */
async function addUsage(db: Db, device: string, domain: string, tz: string, startMinute: number, count: number, seconds: number) {
  await db.query(
    `insert into usage_minutes (device_id, minute_utc, domain, seconds)
     select $1::uuid,
            (date_trunc('day', now() at time zone $2) at time zone $2) + ($5::int + i) * interval '1 minute',
            $3, $6::int
     from generate_series(0, $4::int - 1) i`,
    [device, tz, domain, count, startMinute, seconds],
  );
}

const setTz = (db: Db, familyId: string, tz: string) => db.query("update families set timezone = $1 where id = $2", [tz, familyId]);

const other = (db: Db, device: string) =>
  attempt(db, "service", "select day::text as day, domain, seconds::int as seconds from public.device_other_usage($1::uuid)", [device]);

describe("device_other_usage", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createDb();
  });

  it("Excludes the calling device and sums the others in the family timezone", async () => {
    const a = await seed(db, "A");
    const stranger = await seed(db, "S", 1);
    await setTz(db, a.familyId, TZ);
    const [devA, devB, devC] = a.devices as [string, string, string];
    await addUsage(db, devA, "roblox.com", TZ, 1, 2, 60); // 2 * 60 = 120 s on the caller
    await addUsage(db, devB, "roblox.com", TZ, 1, 5, 60); // 5 * 60 = 300 s
    await addUsage(db, devC, "roblox.com", TZ, 1, 1, 60); // 60 s -> others total 360 s
    await addUsage(db, devB, "roblox.com", TZ, -10, 9, 60); // yesterday, ignored
    await addUsage(db, stranger.devices[0] as string, "roblox.com", TZ, 1, 15, 60); // 900 s of another child
    const today = await scalar<string>(db, "select ((now() at time zone $1)::date)::text", [TZ]);

    const r = await other(db, devA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows.every((row) => row.day === today)).toBe(true);
    expect(r.rows.filter((row) => row.domain === "roblox.com")).toEqual([{ day: today, domain: "roblox.com", seconds: 360 }]);
    expect(r.rows).toHaveLength(1);
  });

  it("Day rollover in the family timezone", async () => {
    // The clock cannot be set in PGlite, so the day edge is built from the real clock: the last minute of
    // yesterday (60 s) and the first minute of today (30 s) in the family timezone.
    const a = await seed(db, "R", 2);
    await setTz(db, a.familyId, TZ);
    const [devA, devB] = a.devices as [string, string];
    await addUsage(db, devB, "roblox.com", TZ, -1, 1, 60);
    await addUsage(db, devB, "roblox.com", TZ, 0, 1, 30);
    const today = await scalar<string>(db, "select ((now() at time zone $1)::date)::text", [TZ]);
    const r = await other(db, devA);
    expect(r.ok && r.rows).toEqual([{ day: today, domain: "roblox.com", seconds: 30 }]);
  });

  it("Defaults and caps", async () => {
    const a = await seed(db, "D", 2);
    const [devA, devB] = a.devices as [string, string];
    // 1200 distinct domains today in UTC, seconds 1 + i % 60: the highest is 60
    await db.query(
      `insert into usage_minutes (device_id, minute_utc, domain, seconds)
       select $1::uuid, date_trunc('day', now() at time zone 'UTC') at time zone 'UTC', 'd' || i || '.com', 1 + (i % 60)
       from generate_series(0, 1199) i`,
      [devB],
    );
    const utcToday = await scalar<string>(db, "select ((now() at time zone 'UTC')::date)::text");
    const r = await other(db, devA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(1000);
    expect(r.rows.every((row) => row.day === utcToday)).toBe(true);
    const seconds = r.rows.map((row) => row.seconds as number);
    expect(seconds[0]).toBe(60);
    expect(seconds).toEqual([...seconds].sort((x, y) => y - x));

    const quiet = await seed(db, "Q", 2);
    const empty = await other(db, quiet.devices[0] as string);
    expect(empty.ok && empty.rows).toEqual([{ day: utcToday, domain: null, seconds: 0 }]);
  });

  it("Permissions", async () => {
    const a = await seed(db, "P", 2);
    const sql = "select * from public.device_other_usage($1::uuid)";
    const params = [a.devices[0]];
    for (const as of ["anon", { parent: a.userId }] as const) {
      const r = await attempt(db, as, sql, params);
      expect(r.ok, JSON.stringify(as)).toBe(false);
      if (!r.ok) expect(r.code).toBe("42501");
    }
    expect((await attempt(db, "service", sql, params)).ok).toBe(true);
  });
});
