import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RETENTION_MONTHS } from "../../apps/web/src/lib/retention";
import { attempt, createDb, createUser, MIGRATIONS_DIR, migrationFiles, type Db } from "./harness";

const PERMISSION_DENIED = "42501";
const NOW = "2026-11-17T12:00:00Z";
// cutoff = NOW - 13 months = 2025-10-17T12:00:00Z
const JUST_OLD = "2025-10-17T11:59:00Z"; // one minute before the cutoff: deleted
const AT_CUTOFF = "2025-10-17T12:00:00Z"; // exactly the cutoff: kept
const RECENT = "2026-11-01T10:00:00Z";

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

const count = (db: Db, table: string) => scalar<number>(db, `select count(*)::int from public.${table}`);

let counter = 0;

async function seedChild(db: Db, name = "Mia") {
  const { userId, familyId } = await createUser(db, "Parent");
  const childId = await scalar<string>(db, "insert into children (family_id, name) values ($1, $2) returning id", [
    familyId,
    name,
  ]);
  counter += 1;
  const deviceId = await scalar<string>(
    db,
    "insert into devices (child_id, token_hash, browser, os) values ($1, $2, 'edge', 'Windows') returning id",
    [childId, `hash-retention-${counter}`],
  );
  return { userId, familyId, childId, deviceId };
}

const addUsage = (db: Db, deviceId: string, at: string) =>
  db.query("insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, $2, 'example.com', 30)", [
    deviceId,
    at,
  ]);
const addBlock = (db: Db, deviceId: string, at: string) =>
  db.query("insert into block_events (device_id, at, domain) values ($1, $2, 'example.com')", [deviceId, at]);

const purge = (db: Db, now = NOW) =>
  attempt(db, "service", "select public.purge_old_data($1::timestamptz) as result", [now]);

async function counts(db: Db, now = NOW) {
  const res = await purge(db, now);
  if (!res.ok) throw new Error(`purge_old_data failed: ${res.message}`);
  return res.rows[0].result as { usage_minutes: number; block_events: number };
}

describe("data retention", () => {
  let db: Db;
  let fam: Awaited<ReturnType<typeof seedChild>>;

  beforeAll(async () => {
    db = await createDb();
    fam = await seedChild(db);
  });

  beforeEach(async () => {
    await db.exec("drop trigger if exists fail_block_delete on public.block_events");
    await db.exec("delete from usage_minutes; delete from block_events; delete from alerts;");
  });

  it("Old rows deleted, recent kept", async () => {
    for (const at of [JUST_OLD, AT_CUTOFF, RECENT]) {
      await addUsage(db, fam.deviceId, at);
      await addBlock(db, fam.deviceId, at);
    }
    // 1 old usage row and 1 old block event are deleted
    expect(await counts(db)).toEqual({ usage_minutes: 1, block_events: 1 });

    const usage = await db.query<{ m: string }>("select minute_utc as m from usage_minutes order by minute_utc");
    expect(usage.rows.map((r) => new Date(r.m).toISOString())).toEqual([
      "2025-10-17T12:00:00.000Z",
      "2026-11-01T10:00:00.000Z",
    ]);
    const blocks = await db.query<{ a: string }>("select at as a from block_events order by at");
    expect(blocks.rows.map((r) => new Date(r.a).toISOString())).toEqual([
      "2025-10-17T12:00:00.000Z",
      "2026-11-01T10:00:00.000Z",
    ]);
  });

  it("Nothing to purge", async () => {
    await addUsage(db, fam.deviceId, RECENT);
    await addBlock(db, fam.deviceId, RECENT);
    expect(await counts(db)).toEqual({ usage_minutes: 0, block_events: 0 });
    expect(await counts(db)).toEqual({ usage_minutes: 0, block_events: 0 });
    expect(await count(db, "usage_minutes")).toBe(1);
    expect(await count(db, "block_events")).toBe(1);
  });

  it("Other tables untouched", async () => {
    const old = "2025-01-01T00:00:00Z";
    await db.query("update children set created_at = $2 where id = $1", [fam.childId, old]);
    await db.query("update devices set created_at = $2, last_seen_at = $2 where id = $1", [fam.deviceId, old]);
    await db.query("insert into block_rules (child_id, kind, value, created_at) values ($1, 'domain', 'example.com', $2)", [
      fam.childId,
      old,
    ]);
    await db.query("insert into alerts (device_id, kind, incident_last_seen_at, sent_at) values ($1, 'offline', $2, $2)", [
      fam.deviceId,
      old,
    ]);
    const before = {
      children: await count(db, "children"),
      devices: await count(db, "devices"),
      block_rules: await count(db, "block_rules"),
      alerts: await count(db, "alerts"),
    };
    await addUsage(db, fam.deviceId, JUST_OLD);

    expect((await counts(db)).usage_minutes).toBe(1);
    expect({
      children: await count(db, "children"),
      devices: await count(db, "devices"),
      block_rules: await count(db, "block_rules"),
      alerts: await count(db, "alerts"),
    }).toEqual(before);
    expect(before.alerts).toBe(1);
    await db.exec("delete from block_rules");
  });

  it("Roles", async () => {
    await addUsage(db, fam.deviceId, JUST_OLD);
    await addBlock(db, fam.deviceId, JUST_OLD);

    for (const as of ["anon", { parent: fam.userId }] as const) {
      const res = await attempt(db, as, "select public.purge_old_data($1::timestamptz)", [NOW]);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe(PERMISSION_DENIED);
    }
    expect(await count(db, "usage_minutes")).toBe(1);
    expect(await count(db, "block_events")).toBe(1);

    const res = await purge(db);
    expect(res.ok).toBe(true);
  });

  it("Migration applies without pg_cron", async () => {
    // createDb() in beforeAll already applied every migration on PGlite, which has no pg_cron
    const file = migrationFiles().find((f) => f.endsWith("_data_retention.sql"));
    expect(file).toBeDefined();
    const available = await scalar<number>(db, "select count(*)::int from pg_available_extensions where name = 'pg_cron'");
    expect(available).toBe(0);
    const exists = await scalar<number>(
      db,
      "select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'purge_old_data'",
    );
    expect(exists).toBe(1);
  });

  it("Migration is newer than every other migration and pins the retention period", () => {
    const files = migrationFiles();
    const file = files.find((f) => f.endsWith("_data_retention.sql")) ?? "";
    expect(file).not.toBe("");
    // newer than every migration that existed when it was built (later migrations may follow it)
    const offlineAlerts = files.find((f) => f.endsWith("_offline_alerts.sql")) ?? "";
    expect(offlineAlerts).not.toBe("");
    expect(files.indexOf(file)).toBeGreaterThan(files.indexOf(offlineAlerts));
    expect(files.slice(files.indexOf(file) + 1).every((f) => f > file)).toBe(true);
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    expect(sql).toContain(`${RETENTION_MONTHS} months`);
    expect(sql).toContain("purge-old-data");
    expect(sql).toContain("23 3 * * *");
  });

  it("Error mid-purge", async () => {
    await addUsage(db, fam.deviceId, JUST_OLD);
    await addBlock(db, fam.deviceId, JUST_OLD);
    await db.exec(`
      create function public.fail_block_delete() returns trigger language plpgsql as $$
      begin raise exception 'forced failure'; end $$;
      create trigger fail_block_delete before delete on public.block_events
        for each row execute function public.fail_block_delete();
    `);

    const failed = await purge(db);
    expect(failed.ok).toBe(false);
    // whole purge rolled back: the old usage row is still there
    expect(await count(db, "usage_minutes")).toBe(1);
    expect(await count(db, "block_events")).toBe(1);

    await db.exec("drop trigger fail_block_delete on public.block_events; drop function public.fail_block_delete();");
    expect(await counts(db)).toEqual({ usage_minutes: 1, block_events: 1 });
    expect(await count(db, "usage_minutes")).toBe(0);
    expect(await count(db, "block_events")).toBe(0);
  });
});

describe("delete child", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createDb();
  });

  it("Cascade removes all child data", async () => {
    const a = await seedChild(db, "Mia");
    const sibling = await db
      .query<{ id: string }>("insert into children (family_id, name) values ($1, 'Noa') returning id", [a.familyId])
      .then((r) => r.rows[0].id);
    counter += 1;
    const siblingDevice = await scalar<string>(
      db,
      "insert into devices (child_id, token_hash, browser, os) values ($1, $2, 'chrome', 'Windows') returning id",
      [sibling, `hash-retention-${counter}`],
    );
    for (const [child, device] of [
      [a.childId, a.deviceId],
      [sibling, siblingDevice],
    ]) {
      await addUsage(db, device, RECENT);
      await addBlock(db, device, RECENT);
      await db.query("insert into block_rules (child_id, kind, value) values ($1, 'domain', 'example.com')", [child]);
    }
    await db.query("insert into pairing_codes (code, child_id, expires_at) values ('AB2CD3', $1, now() + interval '1 hour')", [
      a.childId,
    ]);
    await db.query("insert into pairing_codes (code, child_id, expires_at) values ('XY7ZW9', $1, now() + interval '1 hour')", [
      sibling,
    ]);

    const res = await attempt(db, { parent: a.userId }, "delete from children where id = $1", [a.childId]);
    expect(res.ok && res.affected).toBe(1);

    const left = async (table: string, column: string, id: string) =>
      scalar<number>(db, `select count(*)::int from public.${table} where ${column} = $1`, [id]);
    expect(await left("devices", "child_id", a.childId)).toBe(0);
    expect(await left("usage_minutes", "device_id", a.deviceId)).toBe(0);
    expect(await left("block_events", "device_id", a.deviceId)).toBe(0);
    expect(await left("block_rules", "child_id", a.childId)).toBe(0);
    expect(await left("pairing_codes", "child_id", a.childId)).toBe(0);
    // the other child is untouched
    expect(await left("devices", "child_id", sibling)).toBe(1);
    expect(await left("usage_minutes", "device_id", siblingDevice)).toBe(1);
    expect(await left("block_events", "device_id", siblingDevice)).toBe(1);
    expect(await left("block_rules", "child_id", sibling)).toBe(1);
    expect(await left("pairing_codes", "child_id", sibling)).toBe(1);
  });

  it("Other family cannot delete", async () => {
    const mine = await seedChild(db, "Mia");
    const other = await createUser(db, "Other parent");
    const res = await attempt(db, { parent: other.userId }, "delete from children where id = $1", [mine.childId]);
    expect(res.ok && res.affected).toBe(0);
    expect(await scalar<number>(db, "select count(*)::int from children where id = $1", [mine.childId])).toBe(1);
  });
});
