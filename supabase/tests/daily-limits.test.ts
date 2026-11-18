import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, type Db } from "./harness";

const RLS_VIOLATION = "42501";

type Fam = { userId: string; familyId: string; child: string };

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

async function seed(db: Db, label: string): Promise<Fam> {
  const { userId, familyId } = await createUser(db, `Parent ${label}`);
  const child = await scalar<string>(db, "insert into children (family_id, name) values ($1, $2) returning id", [familyId, label]);
  return { userId, familyId, child };
}

const version = (db: Db, childId: string) =>
  scalar<number>(db, "select rules_version from children where id = $1", [childId]);

const insertLimit = (db: Db, childId: string, category: string, minutes: number) =>
  attempt(db, "service", "insert into child_category_limits (child_id, category, minutes_per_day) values ($1, $2, $3)", [
    childId,
    category,
    minutes,
  ]);

describe("daily limits migration", () => {
  let db: Db;
  let a: Fam;
  let b: Fam;

  beforeAll(async () => {
    db = await createDb();
    a = await seed(db, "A");
    b = await seed(db, "B");
  });

  it("Value constraints", async () => {
    const c = await seed(db, "C");
    for (const [category, minutes] of [
      ["games", 4],
      ["games", 1441],
      ["music", 30],
    ] as const) {
      expect((await insertLimit(db, c.child, category, minutes)).ok, `${category} ${minutes}`).toBe(false);
    }
    expect((await insertLimit(db, c.child, "games", 5)).ok).toBe(true);
    expect((await insertLimit(db, c.child, "news", 1440)).ok).toBe(true);
    expect((await insertLimit(db, c.child, "games", 60)).ok).toBe(false);
  });

  it("Cascade on child delete", async () => {
    const c = await seed(db, "D");
    await insertLimit(db, c.child, "games", 60);
    await insertLimit(db, c.child, "news", 30);
    await db.query("delete from children where id = $1", [c.child]);
    expect(await scalar<number>(db, "select count(*)::int from child_category_limits where child_id = $1", [c.child])).toBe(0);
  });

  it("Parent sees and writes only own family", async () => {
    await insertLimit(db, b.child, "games", 60);

    const select = await attempt(db, { parent: a.userId }, "select * from child_category_limits where child_id = $1", [b.child]);
    expect(select.ok && select.rows).toEqual([]);

    const upd = await attempt(db, { parent: a.userId }, "update child_category_limits set minutes_per_day = 10 where child_id = $1", [b.child]);
    expect(upd.ok && upd.affected).toBe(0);
    const del = await attempt(db, { parent: a.userId }, "delete from child_category_limits where child_id = $1", [b.child]);
    expect(del.ok && del.affected).toBe(0);

    const ins = await attempt(
      db,
      { parent: a.userId },
      "insert into child_category_limits (child_id, category, minutes_per_day) values ($1, 'news', 20)",
      [b.child],
    );
    expect(ins.ok).toBe(false);
    if (!ins.ok) expect(ins.code).toBe(RLS_VIOLATION);
    expect(await scalar<number>(db, "select count(*)::int from child_category_limits where child_id = $1", [b.child])).toBe(1);

    const own = await attempt(
      db,
      { parent: a.userId },
      "insert into child_category_limits (child_id, category, minutes_per_day) values ($1, 'news', 20)",
      [a.child],
    );
    expect(own.ok).toBe(true);
    const ownUpd = await attempt(db, { parent: a.userId }, "update child_category_limits set minutes_per_day = 25 where child_id = $1", [a.child]);
    expect(ownUpd.ok && ownUpd.affected).toBe(1);
    const ownDel = await attempt(db, { parent: a.userId }, "delete from child_category_limits where child_id = $1", [a.child]);
    expect(ownDel.ok && ownDel.affected).toBe(1);
  });

  it("Changes bump rules_version", async () => {
    const c = await seed(db, "E");
    const other = await seed(db, "F");
    expect(await version(db, c.child)).toBe(0);

    await insertLimit(db, c.child, "games", 60);
    expect(await version(db, c.child)).toBe(1);
    await db.query("update child_category_limits set minutes_per_day = 90 where child_id = $1", [c.child]);
    expect(await version(db, c.child)).toBe(3); // 1 + 2 (shared trigger bumps old and new child)
    await db.query("delete from child_category_limits where child_id = $1", [c.child]);
    expect(await version(db, c.child)).toBe(4);
    expect(await version(db, other.child)).toBe(0);
  });

  it("Timezone change bumps the family's children", async () => {
    const f1 = await seed(db, "G");
    const f2 = await scalar<string>(db, "insert into children (family_id, name) values ($1, 'G2') returning id", [f1.familyId]);
    const other = await seed(db, "H");

    await db.query("update families set timezone = 'Asia/Tokyo' where id = $1", [f1.familyId]);
    expect(await version(db, f1.child)).toBe(1);
    expect(await version(db, f2)).toBe(1);
    expect(await version(db, other.child)).toBe(0);

    await db.query("update families set timezone = 'Asia/Tokyo' where id = $1", [f1.familyId]);
    expect(await version(db, f1.child)).toBe(1);
    expect(await version(db, f2)).toBe(1);
    expect(await version(db, other.child)).toBe(0);
  });

  it("Timezone longer than 64 characters is rejected", async () => {
    const f = await seed(db, "T");
    await expect(db.query("update families set timezone = $1 where id = $2", ["x".repeat(65), f.familyId])).rejects.toThrow();
    await db.query("update families set timezone = $1 where id = $2", ["America/Argentina/ComodRivadavia", f.familyId]);
  });
});
