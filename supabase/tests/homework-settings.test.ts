import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, type Db } from "./harness";

const CHECK_VIOLATION = "23514";

type Fam = { userId: string; familyId: string; child: string };
type Settings = { homework_domains: string[]; homework_categories: string[] };

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

async function seed(db: Db, label: string): Promise<Fam> {
  const { userId, familyId } = await createUser(db, `Parent ${label}`);
  const child = await scalar<string>(db, "insert into children (family_id, name) values ($1, $2) returning id", [familyId, label]);
  return { userId, familyId, child };
}

const settingsOf = async (db: Db, childId: string) =>
  (await db.query<Settings>("select homework_domains, homework_categories from children where id = $1", [childId])).rows[0];

const arrayLiteral = (items: string[]) => `{${items.map((i) => `"${i}"`).join(",")}}`;
const setDomains = (db: Db, childId: string, items: string[]) =>
  attempt(db, "service", "update children set homework_domains = $1::text[] where id = $2", [arrayLiteral(items), childId]);

describe("homework settings migration", () => {
  let db: Db;
  let a: Fam;
  let b: Fam;

  beforeAll(async () => {
    db = await createDb();
    a = await seed(db, "A");
    b = await seed(db, "B");
  });

  it("Invalid domain lists rejected", async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `site${i}.example.org`);
    for (const list of [["https://a.com/x"], ["A.com"], tooMany]) {
      const r = await setDomains(db, a.child, list);
      expect(r.ok, list[0]).toBe(false);
      if (!r.ok) expect(r.code).toBe(CHECK_VIOLATION);
    }
    expect((await setDomains(db, a.child, ["school.example.org"])).ok).toBe(true);
  });

  it("Parent edits own child only", async () => {
    const update = (childId: string) =>
      attempt(
        db,
        { parent: a.userId },
        "update children set homework_domains = '{own.example.org}'::text[], homework_categories = '{education,games}'::text[] where id = $1",
        [childId],
      );
    const own = await update(a.child);
    expect(own.ok && own.affected).toBe(1);
    const other = await update(b.child);
    expect(other.ok && other.affected).toBe(0);

    expect(await settingsOf(db, a.child)).toEqual({ homework_domains: ["own.example.org"], homework_categories: ["education", "games"] });
    expect(await settingsOf(db, b.child)).toEqual({ homework_domains: [], homework_categories: ["education"] });
  });

  it("New child defaults to education", async () => {
    const { userId, familyId } = await createUser(db, "Parent C");
    const insert = await attempt(db, { parent: userId }, "insert into children (family_id, name) values ($1, 'Kid') returning id", [familyId]);
    expect(insert.ok).toBe(true);
    if (!insert.ok) return;
    expect(await settingsOf(db, String(insert.rows[0]?.id))).toEqual({ homework_categories: ["education"], homework_domains: [] });
  });

  it("Homework settings do not bump rules version", async () => {
    const version = () => scalar<number>(db, "select rules_version from children where id = $1", [a.child]);
    const before = await version();
    const r = await attempt(
      db,
      { parent: a.userId },
      "update children set homework_categories = '{education,news}'::text[], homework_domains = '{another.example.org}'::text[] where id = $1",
      [a.child],
    );
    expect(r.ok && r.affected).toBe(1);
    expect(await version()).toBe(before);
  });
});
