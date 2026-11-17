import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, type Db } from "./harness";

const CHECK_VIOLATION = "23514";
const RLS_VIOLATION = "42501";

type Fam = { userId: string; familyId: string; child: string; device: string };

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
  return { userId, familyId, child, device };
}

const version = (db: Db, childId: string) =>
  scalar<number>(db, "select rules_version from children where id = $1", [childId]);

const insertRule = (db: Db, childId: string, kind: string, value: string) =>
  attempt(db, "service", "insert into block_rules (child_id, kind, value) values ($1, $2, $3)", [childId, kind, value]);

describe("site blocking migration", () => {
  let db: Db;
  let a: Fam;
  let b: Fam;

  beforeAll(async () => {
    db = await createDb();
    a = await seed(db, "A");
    b = await seed(db, "B");
  });

  it("Invalid rule values rejected", async () => {
    for (const [kind, value] of [
      ["domain", "https://youtube.com/watch"],
      ["domain", "YouTube.com"],
      ["category", "music"],
    ]) {
      const r = await insertRule(db, a.child, kind!, value!);
      expect(r.ok, `${kind} ${value}`).toBe(false);
      if (!r.ok) expect(r.code).toBe(CHECK_VIOLATION);
    }
    expect((await insertRule(db, a.child, "domain", "docs.google.com")).ok).toBe(true);
    expect((await insertRule(db, a.child, "category", "games")).ok).toBe(true);
  });

  it("Parent cannot touch another family's rules", async () => {
    const ruleId = await scalar<string>(
      db,
      "insert into block_rules (child_id, kind, value) values ($1, 'domain', 'family-b.com') returning id",
      [b.child],
    );
    const before = await version(db, b.child);

    const select = await attempt(db, { parent: a.userId }, "select id from block_rules where child_id = $1", [b.child]);
    expect(select.ok && select.rows).toEqual([]);

    const del = await attempt(db, { parent: a.userId }, "delete from block_rules where id = $1", [ruleId]);
    expect(del.ok && del.affected).toBe(0);

    const ins = await attempt(db, { parent: a.userId }, "insert into block_rules (child_id, kind, value) values ($1, 'domain', 'intruder.com')", [b.child]);
    expect(ins.ok).toBe(false);
    if (!ins.ok) expect(ins.code).toBe(RLS_VIOLATION);

    expect(await version(db, b.child)).toBe(before);
    expect(await scalar<number>(db, "select count(*)::int from block_rules where id = $1", [ruleId])).toBe(1);
  });

  it("Resent attempt not double counted", async () => {
    const insert = `insert into block_events (device_id, at, domain) values ($1, $2, $3) on conflict do nothing`;
    const at = "2026-11-17T10:00:00Z";
    expect((await attempt(db, "service", insert, [a.device, at, "tiktok.com"])).ok).toBe(true);
    expect((await attempt(db, "service", insert, [a.device, at, "tiktok.com"])).ok).toBe(true);
    const count = (sql: string, params: unknown[]) => scalar<number>(db, sql, params);
    expect(await count("select count(*)::int from block_events where device_id = $1 and at = $2 and domain = 'tiktok.com'", [a.device, at])).toBe(1);

    expect((await attempt(db, "service", insert, [a.device, at, "snap.com"])).ok).toBe(true);
    expect((await attempt(db, "service", insert, [b.device, at, "tiktok.com"])).ok).toBe(true);
    expect(await count("select count(*)::int from block_events where at = $1", [at])).toBe(3);
  });

  it("Parent sees only own family's events", async () => {
    await db.query("insert into block_events (device_id, at, domain) values ($1, '2026-11-17T11:00:00Z', 'only-a.com'), ($2, '2026-11-17T11:00:00Z', 'only-b.com')", [a.device, b.device]);
    const r = await attempt(
      db,
      { parent: a.userId },
      "select e.domain, d.id as device_id from block_events e join devices d on d.id = e.device_id",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows.length).toBeGreaterThan(0);
      for (const row of r.rows) expect(row.device_id).toBe(a.device);
      const domains = r.rows.map((row) => row.domain);
      expect(domains).toContain("only-a.com");
      expect(domains).not.toContain("only-b.com");
    }
  });
});
