import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, type Db } from "./harness";

const CHECK_VIOLATION = "23514";

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

const setHours = (db: Db, childId: string, start: string | null, end: string | null) =>
  attempt(db, "service", "update children set allowed_start = $1, allowed_end = $2 where id = $3", [start, end, childId]);

const version = (db: Db, childId: string) => scalar<number>(db, "select rules_version from children where id = $1", [childId]);

describe("allowed hours migration", () => {
  let db: Db;
  let a: Fam;
  let b: Fam;

  beforeAll(async () => {
    db = await createDb();
    a = await seed(db, "A");
    b = await seed(db, "B");
  });

  it("Value constraints", async () => {
    const cases: [string | null, string | null, boolean][] = [
      ["07:00", "21:00", true],
      ["07:00", "07:00", false],
      ["24:00", "01:00", false],
      ["7:00", "21:00", false],
      ["07:00", null, false],
      ["22:00", "06:00", true],
    ];
    for (const [start, end, ok] of cases) {
      const r = await setHours(db, a.child, start, end);
      expect(r.ok, `${start}-${end}`).toBe(ok);
      if (!r.ok) expect(r.code).toBe(CHECK_VIOLATION);
    }
  });

  it("Parent edits only own family", async () => {
    const update = (childId: string) =>
      attempt(db, { parent: a.userId }, "update children set allowed_start = '08:00', allowed_end = '20:00' where id = $1", [childId]);
    const other = await update(b.child);
    expect(other.ok && other.affected).toBe(0);
    const own = await update(a.child);
    expect(own.ok && own.affected).toBe(1);
    const direct = await attempt(db, { parent: a.userId }, "update children set rules_version = 99 where id = $1", [a.child]);
    expect(direct.ok).toBe(false);
  });

  it("Changes bump rules_version once", async () => {
    const c = await seed(db, "C");
    const d = await seed(db, "D");
    expect(await version(db, c.child)).toBe(0);
    const dBefore = await version(db, d.child);
    await setHours(db, c.child, "07:00", "21:00");
    expect(await version(db, c.child)).toBe(1);
    await setHours(db, c.child, "07:00", "21:00");
    expect(await version(db, c.child)).toBe(1);
    await setHours(db, c.child, null, null);
    expect(await version(db, c.child)).toBe(2);
    expect(await version(db, d.child)).toBe(dBefore);
  });
});
