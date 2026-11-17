import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, type Db } from "./harness";

const CHECK_VIOLATION = "23514";
const PERMISSION_DENIED = "42501";

type Fam = { userId: string; familyId: string; c1: string; c2: string; device: string };

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

async function seed(db: Db, label: string): Promise<Fam> {
  const { userId, familyId } = await createUser(db, `Parent ${label}`);
  const mk = (name: string) =>
    scalar<string>(db, "insert into children (family_id, name) values ($1, $2) returning id", [familyId, name]);
  const c1 = await mk(`${label}1`);
  const c2 = await mk(`${label}2`);
  const device = await scalar<string>(
    db,
    "insert into devices (child_id, token_hash, browser, os) values ($1, $2, 'chrome', 'Windows') returning id",
    [c1, `hash-${label}-${userId}`],
  );
  return { userId, familyId, c1, c2, device };
}

const version = (db: Db, childId: string) =>
  scalar<number>(db, "select rules_version from children where id = $1", [childId]);

describe("heartbeat migration", () => {
  let db: Db;
  let a: Fam;
  let b: Fam;

  beforeAll(async () => {
    db = await createDb();
    a = await seed(db, "A");
    b = await seed(db, "B");
  });

  it("Resend replaces seconds in the database", async () => {
    const upsert = `insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, '2026-11-17T10:03:00Z', 'youtube.com', $2)
      on conflict (device_id, minute_utc, domain) do update set seconds = excluded.seconds`;
    expect((await attempt(db, "service", upsert, [a.device, 30])).ok).toBe(true);
    expect((await attempt(db, "service", upsert, [a.device, 45])).ok).toBe(true);
    const rows = await db.query<{ seconds: number }>(
      "select seconds from usage_minutes where device_id = $1 and domain = 'youtube.com'",
      [a.device],
    );
    expect(rows.rows).toEqual([{ seconds: 45 }]);
  });

  it("New child starts at 0", async () => {
    const r = await attempt(db, "service", "insert into children (family_id, name) values ($1, 'New') returning rules_version", [a.familyId]);
    expect(r.ok && r.rows[0]).toEqual({ rules_version: 0 });
  });

  it("Block rule changes bump the version", async () => {
    let before = await version(db, a.c1);
    const ins = await attempt(db, { parent: a.userId }, "insert into block_rules (child_id, kind, value) values ($1, 'domain', 'tiktok.com') returning id", [a.c1]);
    expect(ins.ok).toBe(true);
    const ruleId = ins.ok ? (ins.rows[0]!.id as string) : "";
    let after = await version(db, a.c1);
    expect(after).toBeGreaterThan(before);

    before = after;
    expect((await attempt(db, { parent: a.userId }, "update block_rules set value = 'snap.com' where id = $1", [ruleId])).ok).toBe(true);
    after = await version(db, a.c1);
    expect(after).toBeGreaterThan(before);

    before = after;
    expect((await attempt(db, { parent: a.userId }, "delete from block_rules where id = $1", [ruleId])).ok).toBe(true);
    expect(await version(db, a.c1)).toBeGreaterThan(before);
  });

  it("Deleting a child with rules", async () => {
    const c = await scalar<string>(db, "insert into children (family_id, name) values ($1, 'Doomed') returning id", [a.familyId]);
    await db.query("insert into block_rules (child_id, kind, value) values ($1, 'domain', 'x.com')", [c]);
    const dBefore = await version(db, a.c2);
    const del = await attempt(db, { parent: a.userId }, "delete from children where id = $1", [c]);
    expect(del.ok).toBe(true);
    expect(await version(db, a.c2)).toBe(dBefore);
  });

  it("Family override bumps all children of the family only", async () => {
    const [c1, c2, d] = [await version(db, a.c1), await version(db, a.c2), await version(db, b.c1)];
    const r = await attempt(db, { parent: a.userId }, "insert into domain_categories (family_id, domain, category) values ($1, 'override-a.com', 'games')", [a.familyId]);
    expect(r.ok).toBe(true);
    expect(await version(db, a.c1)).toBeGreaterThan(c1);
    expect(await version(db, a.c2)).toBeGreaterThan(c2);
    expect(await version(db, b.c1)).toBe(d);
  });

  it("Global category does not bump", async () => {
    const ids = [a.c1, a.c2, b.c1, b.c2];
    const before = await Promise.all(ids.map((id) => version(db, id)));
    const r = await attempt(db, "service", "insert into domain_categories (family_id, domain, category) values (null, 'global-one.com', 'news')");
    expect(r.ok).toBe(true);
    expect(await Promise.all(ids.map((id) => version(db, id)))).toEqual(before);
  });

  it("Override moved between families", async () => {
    const id = await scalar<string>(db, "insert into domain_categories (family_id, domain, category) values ($1, 'moving.com', 'games') returning id", [a.familyId]);
    const ids = [a.c1, a.c2, b.c1, b.c2];
    const before = await Promise.all(ids.map((x) => version(db, x)));
    const r = await attempt(db, "service", "update domain_categories set family_id = $1 where id = $2", [b.familyId, id]);
    expect(r.ok).toBe(true);
    const after = await Promise.all(ids.map((x) => version(db, x)));
    after.forEach((v, i) => expect(v).toBeGreaterThan(before[i]!));
  });

  it("Other family's rule does not bump", async () => {
    const [c1, c2] = [await version(db, a.c1), await version(db, a.c2)];
    const r = await attempt(db, { parent: b.userId }, "insert into block_rules (child_id, kind, value) values ($1, 'domain', 'other.com')", [b.c1]);
    expect(r.ok).toBe(true);
    expect(await version(db, a.c1)).toBe(c1);
    expect(await version(db, a.c2)).toBe(c2);
  });

  it("Parent cannot write rules_version", async () => {
    const v = await version(db, a.c1);
    const upd = await attempt(db, { parent: a.userId }, "update children set rules_version = 99 where id = $1", [a.c1]);
    const ins = await attempt(db, { parent: a.userId }, "insert into children (family_id, name, rules_version) values ($1, 'Sneaky', 5)", [a.familyId]);
    expect(upd.ok).toBe(false);
    expect(ins.ok).toBe(false);
    if (!upd.ok) expect(upd.code).toBe(PERMISSION_DENIED);
    if (!ins.ok) expect(ins.code).toBe(PERMISSION_DENIED);
    expect(await version(db, a.c1)).toBe(v);
  });

  it("Parent can still rename a child", async () => {
    const v = await version(db, a.c2);
    const upd = await attempt(db, { parent: a.userId }, "update children set name = 'Renamed', homework_categories = array['education'] where id = $1", [a.c2]);
    expect(upd.ok).toBe(true);
    expect(await version(db, a.c2)).toBe(v);
    const ins = await attempt(db, { parent: a.userId }, "insert into children (name, family_id) values ('Third', $1)", [a.familyId]);
    expect(ins.ok).toBe(true);
  });

  it("Trigger functions not executable by API roles", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      for (const fn of ["bump_rules_version", "bump_family_rules_version"]) {
        const r = await attempt(db, role === "anon" ? "anon" : { parent: a.userId }, `select public.${fn}()`);
        expect(r.ok, `${role} ${fn}`).toBe(false);
        if (!r.ok) expect(r.code).toBe(PERMISSION_DENIED);
      }
    }
    for (const fn of ["bump_rules_version()", "bump_family_rules_version()"]) {
      for (const role of ["public", "anon", "authenticated"]) {
        const ok = await scalar<boolean>(db, `select has_function_privilege('${role}', 'public.${fn}', 'execute')`);
        expect(ok, `${role} ${fn}`).toBe(false);
      }
    }
    const before = await version(db, a.c1);
    const r = await attempt(db, { parent: a.userId }, "insert into block_rules (child_id, kind, value) values ($1, 'domain', 'still-bumps.com')", [a.c1]);
    expect(r.ok).toBe(true);
    expect(await version(db, a.c1)).toBeGreaterThan(before);
  });

  it("Column constraint and privilege", async () => {
    const tooLong = await attempt(db, "service", "update devices set extension_version = $1 where id = $2", ["x".repeat(33), a.device]);
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.code).toBe(CHECK_VIOLATION);
    const okUpdate = await attempt(db, "service", "update devices set extension_version = '0.2.0' where id = $1", [a.device]);
    expect(okUpdate.ok).toBe(true);

    const read = await attempt(db, { parent: a.userId }, "select extension_version from devices where id = $1", [a.device]);
    expect(read.ok && read.rows).toEqual([{ extension_version: "0.2.0" }]);
    const hash = await attempt(db, { parent: a.userId }, "select token_hash from devices");
    expect(hash.ok).toBe(false);
  });
});
