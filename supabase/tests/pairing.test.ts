import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, MIGRATIONS_DIR, type Db } from "./harness";

const CHECK_VIOLATION = "23514";
const PERMISSION_DENIED = "42501";

type Fam = { userId: string; familyId: string; child: string };

const H1 = "1".repeat(64);
const H2 = "2".repeat(64);
const hex = (n: number) => n.toString(16).padStart(64, "0");

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

async function seed(db: Db, label: string): Promise<Fam> {
  const { userId, familyId } = await createUser(db, `Parent ${label}`);
  const child = await scalar<string>(db, "insert into children (family_id, name) values ($1, $2) returning id", [
    familyId,
    `${label}1`,
  ]);
  return { userId, familyId, child };
}

const addCode = (db: Db, code: string, childId: string, interval = "1 hour") =>
  db.query(`insert into pairing_codes (code, child_id, expires_at) values ($1, $2, now() + interval '${interval}')`, [
    code,
    childId,
  ]);

const redeem = (db: Db, as: { parent: string } | "anon" | "service", code: string, tokenHash: string) =>
  attempt(db, as, "select public.redeem_pairing_code($1, $2, 'edge', 'Windows') as id", [code, tokenHash]);

const register = (db: Db, as: { parent: string } | "anon" | "service", hash: string) =>
  attempt(db, as, "select public.register_pair_attempt($1) as n", [hash]);

const deviceCount = (db: Db) => scalar<number>(db, "select count(*)::int from devices");
const codeCount = (db: Db, code: string) =>
  scalar<number>(db, "select count(*)::int from pairing_codes where code = $1", [code]);

describe("device pairing migration", () => {
  let db: Db;
  let a: Fam;
  let b: Fam;
  let n = 100;

  beforeAll(async () => {
    db = await createDb();
    a = await seed(db, "A");
    b = await seed(db, "B");
  });

  it("Redeem creates a device and consumes the code", async () => {
    await addCode(db, "AB2CD3", a.child);
    const hash = hex(++n);
    const res = await redeem(db, "service", "AB2CD3", hash);
    expect(res.ok).toBe(true);
    const id = res.ok ? (res.rows[0].id as string) : "";
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const device = (await db.query<Record<string, unknown>>("select * from devices where id = $1", [id])).rows[0];
    expect(device).toMatchObject({ child_id: a.child, browser: "edge", os: "Windows", token_hash: hash });
    expect(await codeCount(db, "AB2CD3")).toBe(0);
  });

  it("Second use and expired code return null", async () => {
    await addCode(db, "AB2CD3", a.child);
    expect((await redeem(db, "service", "AB2CD3", hex(++n))).ok).toBe(true);
    await addCode(db, "EXPRD2", a.child, "-1 hour");
    const before = await deviceCount(db);
    for (const code of ["AB2CD3", "EXPRD2", "UNKNW2"]) {
      const res = await redeem(db, "service", code, hex(++n));
      expect(res.ok).toBe(true);
      expect(res.ok && res.rows[0].id).toBeNull();
    }
    expect(await deviceCount(db)).toBe(before);
    expect(await codeCount(db, "EXPRD2")).toBe(1);
  });

  it("Only the service role may redeem", async () => {
    await addCode(db, "PRIV22", a.child);
    for (const as of [{ parent: a.userId }, "anon" as const]) {
      const res = await redeem(db, as, "PRIV22", hex(++n));
      expect(res.ok).toBe(false);
      expect(!res.ok && res.code).toBe(PERMISSION_DENIED);
    }
    expect(await codeCount(db, "PRIV22")).toBe(1);
  });

  it("Old code A stops working when B is generated", async () => {
    await addCode(db, "AAAAAA", a.child);
    const del = await attempt(db, { parent: a.userId }, "delete from pairing_codes where child_id = $1", [a.child]);
    expect(del.ok).toBe(true);
    const ins = await attempt(
      db,
      { parent: a.userId },
      "insert into pairing_codes (code, child_id, expires_at) values ('BBBBBB', $1, now() + interval '1 hour')",
      [a.child],
    );
    expect(ins.ok).toBe(true);
    const old = await redeem(db, "service", "AAAAAA", hex(++n));
    expect(old.ok && old.rows[0].id).toBeNull();
    const fresh = await redeem(db, "service", "BBBBBB", hex(++n));
    expect(fresh.ok && fresh.rows[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("A parent cannot delete another family's codes", async () => {
    await addCode(db, "CCCCCC", b.child);
    const del = await attempt(db, { parent: a.userId }, "delete from pairing_codes where child_id = $1", [b.child]);
    expect(del.ok && del.affected).toBe(0);
    expect(await codeCount(db, "CCCCCC")).toBe(1);
    const res = await redeem(db, "service", "CCCCCC", hex(++n));
    expect(res.ok && res.rows[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("pair_attempts migration", () => {
  let db: Db;
  let a: Fam;

  beforeAll(async () => {
    db = await createDb();
    a = await seed(db, "A");
  });

  const clear = () => db.query("delete from pair_attempts");

  it("Counting per hash", async () => {
    await clear();
    const counts: unknown[] = [];
    for (const hash of [H1, H1, H1, H2]) {
      const res = await register(db, "service", hash);
      counts.push(res.ok ? res.rows[0].n : res);
    }
    expect(counts).toEqual([1, 2, 3, 1]);
  });

  it("Old attempts are purged and not counted", async () => {
    await clear();
    for (const hash of [H1, H2]) {
      await db.query("insert into pair_attempts (ip_hash, at) values ($1, now() - interval '11 minutes')", [hash]);
    }
    const res = await register(db, "service", H1);
    expect(res.ok && res.rows[0].n).toBe(1);
    const old = await scalar<number>(
      db,
      "select count(*)::int from pair_attempts where at < now() - interval '10 minutes'",
    );
    expect(old).toBe(0);
  });

  it("Purge runs without new attempts", async () => {
    await clear();
    await db.query("insert into pair_attempts (ip_hash, at) values ($1, now() - interval '11 minutes')", [H1]);
    await db.query("insert into pair_attempts (ip_hash, at) values ($1, now() - interval '5 minutes')", [H2]);
    expect((await attempt(db, "service", "select public.purge_pair_attempts()")).ok).toBe(true);
    const rows = (await db.query<{ ip_hash: string }>("select ip_hash from pair_attempts")).rows;
    expect(rows.map((r) => r.ip_hash)).toEqual([H2]);
    for (const as of [{ parent: a.userId }, "anon" as const]) {
      const res = await attempt(db, as, "select public.purge_pair_attempts()");
      expect(res.ok).toBe(false);
      expect(!res.ok && res.code).toBe(PERMISSION_DENIED);
    }
  });

  it("Daily purge job is scheduled", () => {
    const file = readdirSync(MIGRATIONS_DIR).find((f) => f.endsWith("_device_pairing.sql"));
    expect(file).toBeDefined();
    const sql = readFileSync(join(MIGRATIONS_DIR, file ?? ""), "utf8");
    expect(sql).toMatch(
      /cron\.schedule\(\s*'purge-pair-attempts'\s*,\s*'[^']*'\s*,\s*'select public\.purge_pair_attempts\(\)'\s*\)/,
    );
    expect(sql).toMatch(/pg_extension[\s\S]*extname\s*=\s*'pg_cron'/);
    expect(sql.search(/extname\s*=\s*'pg_cron'/)).toBeLessThan(sql.search(/cron\.schedule/));
  });

  it("Raw IPs and outsiders rejected", async () => {
    await clear();
    await db.query("insert into pair_attempts (ip_hash) values ($1)", [H1]);
    const raw = await attempt(db, "service", "insert into pair_attempts (ip_hash) values ('203.0.113.5')");
    expect(raw.ok).toBe(false);
    expect(!raw.ok && raw.code).toBe(CHECK_VIOLATION);
    for (const as of [{ parent: a.userId }, "anon" as const]) {
      const sel = await attempt(db, as, "select * from pair_attempts");
      expect(sel.ok ? sel.rows : []).toEqual([]);
      const call = await register(db, as, H1);
      expect(call.ok).toBe(false);
      expect(!call.ok && call.code).toBe(PERMISSION_DENIED);
    }
  });
});
