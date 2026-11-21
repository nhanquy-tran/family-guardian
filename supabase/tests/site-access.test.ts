import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, MIGRATIONS_DIR, migrationFiles, type Db } from "./harness";

const PERMISSION_DENIED = "42501";
const UNIQUE_VIOLATION = "23505";

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

let counter = 0;

async function seedDevice(db: Db, familyId: string, childName = "Mia"): Promise<string> {
  const childId = await scalar<string>(db, "insert into children (family_id, name) values ($1, $2) returning id", [
    familyId,
    childName,
  ]);
  counter += 1;
  return scalar<string>(
    db,
    "insert into devices (child_id, token_hash, browser, os) values ($1, $2, 'firefox', 'Windows') returning id",
    [childId, `hash-site-access-${counter}`],
  );
}

const setAccess = (db: Db, deviceId: string, value: boolean) =>
  db.query("update devices set site_access = $2 where id = $1", [deviceId, value]);

const incidents = async (db: Db, deviceId: string) =>
  (
    await db.query<{ id: string; started_at: string | null; resolved_at: string | null }>(
      "select id, started_at, resolved_at from site_access_incidents where device_id = $1 order by started_at, id",
      [deviceId],
    )
  ).rows;

const denied = (res: Awaited<ReturnType<typeof attempt>>) => !res.ok || res.affected === 0;

describe("site access migration", () => {
  let db: Db;
  let a: Awaited<ReturnType<typeof createUser>>;
  let b: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    db = await createDb();
    a = await createUser(db, "Parent A");
    b = await createUser(db, "Parent B");
  });

  it("Default, read and write rights", async () => {
    const d = await seedDevice(db, a.familyId);
    expect(await scalar<boolean>(db, "select site_access from devices where id = $1", [d])).toBe(true);

    const read = await attempt(db, { parent: a.userId }, "select site_access from devices where id = $1", [d]);
    expect(read.ok && read.rows[0]?.site_access).toBe(true);

    const write = "update devices set site_access = false where id = $1";
    const parent = await attempt(db, { parent: a.userId }, write, [d]);
    expect(denied(parent)).toBe(true);
    const anon = await attempt(db, "anon", write, [d]);
    expect(denied(anon)).toBe(true);
    expect(await scalar<boolean>(db, "select site_access from devices where id = $1", [d])).toBe(true);

    const service = await attempt(db, "service", write, [d]);
    expect(service.ok).toBe(true);
    expect(await scalar<boolean>(db, "select site_access from devices where id = $1", [d])).toBe(false);

    const token = await attempt(db, { parent: a.userId }, "select token_hash from devices where id = $1", [d]);
    expect(token.ok).toBe(false);
    expect(!token.ok && token.code).toBe(PERMISSION_DENIED);
  });

  it("Incident lifecycle", async () => {
    const d = await seedDevice(db, a.familyId);
    expect(await incidents(db, d)).toHaveLength(0);

    await setAccess(db, d, false);
    await setAccess(db, d, false); // repeated value changes nothing
    expect(await incidents(db, d)).toHaveLength(1);
    await setAccess(db, d, true);
    const resolved = (await incidents(db, d))[0]!;
    expect(resolved.started_at).not.toBeNull();
    expect(resolved.resolved_at).not.toBeNull();
    await setAccess(db, d, true);
    const afterRepeat = (await incidents(db, d))[0]!;
    expect(afterRepeat.resolved_at).toEqual(resolved.resolved_at);
    expect(afterRepeat.started_at).toEqual(resolved.started_at);

    await setAccess(db, d, false);
    const two = await incidents(db, d);
    expect(two).toHaveLength(2);
    expect(two.filter((i) => i.resolved_at === null)).toHaveLength(1);
    expect(two[1]!.resolved_at).toBeNull();
    expect(two[0]!.resolved_at).toEqual(resolved.resolved_at);

    const extra = await attempt(db, "service", "insert into site_access_incidents (device_id) values ($1)", [d]);
    expect(extra.ok).toBe(false);
    expect(!extra.ok && extra.code).toBe(UNIQUE_VIOLATION);

    const fn = await db.query<{ prosecdef: boolean; proconfig: string[] | null }>(
      "select prosecdef, proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'record_site_access_change'",
    );
    expect(fn.rows[0]?.prosecdef).toBe(true);
    expect((fn.rows[0]?.proconfig ?? []).join(",")).toMatch(/search_path=/);
    for (const role of ["anon", "authenticated", "public"]) {
      expect(await scalar<boolean>(db, `select has_function_privilege('${role}', 'public.record_site_access_change()', 'execute')`)).toBe(false);
    }

    await db.query("delete from devices where id = $1", [d]);
    expect(await incidents(db, d)).toHaveLength(0);
  });

  it("Family isolation and no writes", async () => {
    const da = await seedDevice(db, a.familyId, "Mia");
    const dbb = await seedDevice(db, b.familyId, "Leo");
    await setAccess(db, da, false);
    await setAccess(db, dbb, false);

    const all = await attempt(db, { parent: a.userId }, "select device_id from site_access_incidents");
    expect(all.ok).toBe(true);
    const ids = all.ok ? all.rows.map((r) => r.device_id) : [];
    expect(ids).toContain(da);
    expect(ids).not.toContain(dbb);

    const target = (await incidents(db, da))[0]!;
    const writes = [
      "insert into site_access_incidents (device_id) values ($1)",
      "update site_access_incidents set resolved_at = now() where device_id = $1",
      "delete from site_access_incidents where device_id = $1",
    ];
    for (const role of [{ parent: a.userId }, "anon"] as const) {
      for (const sql of writes) expect(denied(await attempt(db, role, sql, [da])), sql).toBe(true);
    }
    expect(await incidents(db, da)).toEqual([target]);
  });

  it("Purge boundary, permissions and no pg_cron", async () => {
    const available = await scalar<number>(db, "select count(*)::int from pg_available_extensions where name = 'pg_cron'");
    expect(available).toBe(0);
    const file = migrationFiles().find((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8").includes("purge_site_access_incidents"));
    expect(file).toBeDefined();

    const d1 = await seedDevice(db, a.familyId);
    const d2 = await seedDevice(db, a.familyId);
    const add = (device: string, startedDaysAgo: number, resolvedDaysAgo: number | null) =>
      scalar<string>(
        db,
        `insert into site_access_incidents (device_id, started_at, resolved_at)
         values ($1, now() - make_interval(days => $2), case when $3::int is null then null else now() - make_interval(days => $3::int) end)
         returning id`,
        [device, startedDaysAgo, resolvedDaysAgo],
      );
    const resolved91 = await add(d1, 92, 91); // coalesce = 91 days ago: deleted
    const resolved89 = await add(d1, 90, 89); // 89 days ago: kept
    const open91 = await add(d1, 91, null); // started 91 days ago: deleted
    const open1 = await add(d2, 1, null); // started 1 day ago: kept

    for (const role of ["anon", { parent: a.userId }] as const) {
      const res = await attempt(db, role, "select public.purge_site_access_incidents()");
      expect(res.ok).toBe(false);
      expect(!res.ok && res.code).toBe(PERMISSION_DENIED);
    }
    const service = await attempt(db, "service", "select public.purge_site_access_incidents()");
    expect(service.ok).toBe(true);

    const left = (await db.query<{ id: string }>("select id from site_access_incidents where id = any($1::uuid[])", [[resolved91, resolved89, open91, open1]])).rows.map((r) => r.id);
    expect(left.sort()).toEqual([resolved89, open1].sort());
  });
});
