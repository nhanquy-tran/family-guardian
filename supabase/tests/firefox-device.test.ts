import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, type Db } from "./harness";

const TZ = "Asia/Ho_Chi_Minh";

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

describe("several browsers of one child", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createDb();
  });

  async function seed(label: string) {
    const { familyId } = await createUser(db, `Parent ${label}`);
    await db.query("update families set timezone = $1 where id = $2", [TZ, familyId]);
    const child = await scalar<string>(db, "insert into children (family_id, name) values ($1, $2) returning id", [familyId, label]);
    const chrome = await scalar<string>(
      db,
      "insert into devices (child_id, token_hash, browser, os) values ($1, $2, 'chrome', 'Windows') returning id",
      [child, `hash-chrome-${label}`.padEnd(64, "0")],
    );
    return { child, chrome };
  }

  it("Pairing Firefox keeps the Chrome device", async () => {
    const { child, chrome } = await seed("P");
    const before = (await db.query<Record<string, unknown>>("select * from devices where id = $1", [chrome])).rows[0];
    await db.query("insert into pairing_codes (code, child_id, expires_at) values ('FF2CD3', $1, now() + interval '1 hour')", [child]);
    const res = await attempt(db, "service", "select public.redeem_pairing_code('FF2CD3', $1, 'firefox', 'Windows') as id", ["f".repeat(64)]);
    expect(res.ok).toBe(true);
    const devices = await db.query<{ browser: string }>("select browser from devices where child_id = $1 order by browser", [child]);
    expect(devices.rows.map((d) => d.browser)).toEqual(["chrome", "firefox"]);
    const after = (await db.query<Record<string, unknown>>("select * from devices where id = $1", [chrome])).rows[0];
    expect(after).toEqual(before);
  });

  it("Totals and other-device usage include both browsers", async () => {
    const { child, chrome } = await seed("T");
    const firefox = await scalar<string>(
      db,
      "insert into devices (child_id, token_hash, browser, os) values ($1, $2, 'firefox', 'Windows') returning id",
      [child, "hash-firefox-T".padEnd(64, "0")],
    );
    // local noon today in the family timezone, so the rows are always inside "today"
    const noon = "(date_trunc('day', now() at time zone $1) + interval '12 hours') at time zone $1";
    const add = (device: string, extraMinutes: number) =>
      db.query(
        `insert into usage_minutes (device_id, minute_utc, domain, seconds)
         values ($2::uuid, ${noon} + $3::int * interval '1 minute', 'example.com', 60)`,
        [TZ, device, extraMinutes],
      );
    await add(chrome, 0); // 60 s
    await add(firefox, 0); // 60 s
    await add(firefox, 1); // 60 s -> firefox 120 s, child 180 s

    const total = await scalar<number>(
      db,
      "select seconds::int from public.usage_total_seconds($1::uuid[], now() - interval '2 days', now() + interval '2 days')",
      [`{${child}}`],
    );
    expect(total).toBe(180);

    const byDay = await attempt(db, "service", "select seconds::int as seconds from public.usage_by_day($1::uuid, $2, 3)", [child, TZ]);
    expect(byDay.ok && byDay.rows.reduce((sum, r) => sum + (r.seconds as number), 0)).toBe(180);

    const others = async (device: string) => {
      const r = await attempt(db, "service", "select domain, seconds::int as seconds from public.device_other_usage($1::uuid)", [device]);
      return r.ok ? r.rows.filter((x) => x.domain === "example.com") : null;
    };
    expect(await others(chrome)).toEqual([expect.objectContaining({ domain: "example.com", seconds: 120 })]);
    expect(await others(firefox)).toEqual([expect.objectContaining({ domain: "example.com", seconds: 60 })]);
  });
});
