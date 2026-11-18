import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, type Db } from "./harness";

const RLS_VIOLATION = "42501";

type Fam = { userId: string; familyId: string; children: string[] };

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

async function seed(db: Db, label: string, childCount: number): Promise<Fam> {
  const { userId, familyId } = await createUser(db, `Parent ${label}`);
  const children: string[] = [];
  for (let i = 0; i < childCount; i++) {
    children.push(
      await scalar<string>(db, "insert into children (family_id, name) values ($1, $2) returning id", [familyId, `${label}${i}`]),
    );
  }
  return { userId, familyId, children };
}

const version = (db: Db, childId: string) =>
  scalar<number>(db, "select rules_version from children where id = $1", [childId]);

describe("category overrides migration", () => {
  let db: Db;
  let a: Fam;
  let b: Fam;

  beforeAll(async () => {
    db = await createDb();
    a = await seed(db, "A", 2);
    b = await seed(db, "B", 1);
  });

  it("Parent reads global and own rows only", async () => {
    await db.query("insert into domain_categories (family_id, domain, category) values (null, 'global-read.test', 'news')");
    await db.query("insert into domain_categories (family_id, domain, category) values ($1, 'a-read.test', 'games')", [a.familyId]);
    await db.query("insert into domain_categories (family_id, domain, category) values ($1, 'b-read.test', 'games')", [b.familyId]);

    const res = await attempt(
      db,
      { parent: a.userId },
      "select domain from domain_categories where domain in ('global-read.test', 'a-read.test', 'b-read.test') order by domain",
    );
    expect(res.ok && res.rows.map((r) => r.domain)).toEqual(["a-read.test", "global-read.test"]);
  });

  it("Parent cannot write global or foreign rows", async () => {
    await db.query("insert into domain_categories (family_id, domain, category) values (null, 'global-write.test', 'news')");
    await db.query("insert into domain_categories (family_id, domain, category) values ($1, 'b-write.test', 'games')", [b.familyId]);

    const insGlobal = await attempt(db, { parent: a.userId }, "insert into domain_categories (family_id, domain, category) values (null, 'new-global.test', 'news')");
    expect(insGlobal.ok).toBe(false);
    if (!insGlobal.ok) expect(insGlobal.code).toBe(RLS_VIOLATION);

    const insForeign = await attempt(
      db,
      { parent: a.userId },
      "insert into domain_categories (family_id, domain, category) values ($1, 'new-foreign.test', 'news')",
      [b.familyId],
    );
    expect(insForeign.ok).toBe(false);
    if (!insForeign.ok) expect(insForeign.code).toBe(RLS_VIOLATION);

    for (const sql of [
      "update domain_categories set category = 'other' where domain = 'global-write.test'",
      "delete from domain_categories where domain = 'global-write.test'",
      "update domain_categories set category = 'other' where domain = 'b-write.test'",
      "delete from domain_categories where domain = 'b-write.test'",
    ]) {
      const res = await attempt(db, { parent: a.userId }, sql);
      expect(res.ok && res.affected, sql).toBe(0);
    }
    expect(await scalar<number>(db, "select count(*)::int from domain_categories where domain in ('global-write.test', 'b-write.test')")).toBe(2);
  });

  it("Family changes bump every child of the family only", async () => {
    const start = await Promise.all(a.children.map((c) => version(db, c)));
    const startB = await version(db, b.children[0]!);

    const steps = [
      "insert into domain_categories (family_id, domain, category) select family_id, 'bump.test', 'games' from parents where user_id = auth.uid()",
      "update domain_categories set category = 'education' where domain = 'bump.test'",
      "delete from domain_categories where domain = 'bump.test'",
    ];
    for (const [i, sql] of steps.entries()) {
      const res = await attempt(db, { parent: a.userId }, sql);
      expect(res.ok, sql).toBe(true);
      const now = await Promise.all(a.children.map((c) => version(db, c)));
      expect(now, `step ${i + 1}`).toEqual(start.map((v) => v + i + 1)); // +1 per step
      expect(await version(db, b.children[0]!)).toBe(startB);
    }
  });
});
