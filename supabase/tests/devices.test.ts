import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createDbFromMigrations, createUser, migrationFiles, type Db } from "./harness";

const CHECK_VIOLATION = "23514";
const PERMISSION_DENIED = "42501";

type Fam = { userId: string; familyId: string; child: string; device: string; hash: string };

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

async function seed(db: Db, label: string): Promise<Fam> {
  const { userId, familyId } = await createUser(db, `Parent ${label}`);
  const child = await scalar<string>(db, "insert into children (family_id, name) values ($1, $2) returning id", [
    familyId,
    `Kid ${label}`,
  ]);
  const hash = `h-${label.toLowerCase()}`;
  const device = await scalar<string>(
    db,
    "insert into devices (child_id, token_hash, browser, os) values ($1, $2, 'chrome', 'Windows') returning id",
    [child, hash],
  );
  return { userId, familyId, child, device, hash };
}

const nameOf = (db: Db, id: string) => scalar<string | null>(db, "select name from devices where id = $1", [id]);

describe("devices migration", () => {
  let db: Db;
  let a: Fam;
  let b: Fam;

  beforeAll(async () => {
    db = await createDb();
    a = await seed(db, "A");
    b = await seed(db, "B");
  });

  it("columns and limits", async () => {
    const empty = await attempt(db, "service", "update devices set name = '' where id = $1", [a.device]);
    const long = await attempt(db, "service", "update devices set name = $1 where id = $2", ["x".repeat(41), a.device]);
    for (const r of [empty, long]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe(CHECK_VIOLATION);
    }
    const ok = await attempt(db, "service", "update devices set name = 'Laptop' where id = $1", [a.device]);
    expect(ok.ok).toBe(true);
    expect(await nameOf(db, a.device)).toBe("Laptop");
    await db.query("update devices set name = null where id = $1", [a.device]);

    const fresh = await scalar<string | null>(
      db,
      "insert into devices (child_id, token_hash, browser, os) values ($1, 'h-fresh', 'edge', 'Windows') returning name",
      [a.child],
    );
    expect(fresh).toBeNull();

    const files = migrationFiles();
    expect(files).toContain("20261118090000_devices_name.sql");
    expect(files.indexOf("20261118090000_devices_name.sql")).toBeGreaterThan(
      files.indexOf("20261117100000_heartbeat.sql"),
    );
    await expect(createDbFromMigrations()).resolves.toBeDefined();
  });

  it("parent reads the new columns", async () => {
    const r = await attempt(
      db,
      { parent: a.userId },
      "select id, name, extension_version, last_seen_at from devices",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const ids = r.rows.map((row) => row.id);
      expect(ids).toContain(a.device);
      expect(ids).not.toContain(b.device);
    }
  });

  it("rename own device", async () => {
    const r = await attempt(db, { parent: a.userId }, "update devices set name = $1 where id = $2", [
      "Lan's laptop",
      a.device,
    ]);
    expect(r.ok && r.affected).toBe(1);
    expect(await nameOf(db, a.device)).toBe("Lan's laptop");
  });

  it("cannot rename another family's device", async () => {
    const before = await nameOf(db, b.device);
    const r = await attempt(db, { parent: a.userId }, "update devices set name = 'Hacked' where id = $1", [b.device]);
    expect(r.ok && r.affected).toBe(0);
    expect(await nameOf(db, b.device)).toBe(before);
  });

  it("cannot change other columns", async () => {
    const statements = [
      "update devices set token_hash = 'stolen' where id = $1",
      `update devices set child_id = '${b.child}' where id = $1`,
      "update devices set last_seen_at = now() where id = $1",
      "update devices set browser = 'brave' where id = $1",
      "update devices set os = 'Linux' where id = $1",
      "update devices set extension_version = '9.9.9' where id = $1",
    ];
    for (const sql of statements) {
      const r = await attempt(db, { parent: a.userId }, sql, [a.device]);
      expect(r.ok, sql).toBe(false);
      if (!r.ok) expect(r.code, sql).toBe(PERMISSION_DENIED);
    }
  });

  it("token no longer matches", async () => {
    await db.query(
      "insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, '2026-11-17T10:03:00Z', 'youtube.com', 30)",
      [a.device],
    );
    const del = await attempt(db, { parent: a.userId }, "delete from devices where id = $1", [a.device]);
    expect(del.ok && del.affected).toBe(1);
    expect(await scalar<number>(db, "select count(*)::int from devices where token_hash = $1", [a.hash])).toBe(0);
    expect(await scalar<number>(db, "select count(*)::int from usage_minutes where device_id = $1", [a.device])).toBe(0);
    expect(await scalar<number>(db, "select count(*)::int from devices where id = $1", [b.device])).toBe(1);
  });
});
