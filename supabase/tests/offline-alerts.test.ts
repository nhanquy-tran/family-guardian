import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, MIGRATIONS_DIR, migrationFiles, type Db } from "./harness";

const PERMISSION_DENIED = "42501";
const UNIQUE_VIOLATION = "23505";

const NOW = "2026-11-17T12:00:00Z";
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

let counter = 0;

async function seedFamily(db: Db) {
  const { userId, familyId } = await createUser(db, "Parent");
  const childId = await scalar<string>(db, "insert into children (family_id, name) values ($1, 'Mia') returning id", [familyId]);
  return { userId, familyId, childId };
}

const newChild = (db: Db, familyId: string) =>
  scalar<string>(db, "insert into children (family_id, name) values ($1, 'Kid') returning id", [familyId]);

/** Creates a device last seen `agoMs` before NOW (null = never seen). */
async function device(db: Db, childId: string, agoMs: number | null): Promise<string> {
  const lastSeen = agoMs === null ? null : new Date(Date.parse(NOW) - agoMs).toISOString();
  counter += 1;
  return scalar<string>(
    db,
    "insert into devices (child_id, token_hash, browser, os, last_seen_at) values ($1, $2, 'edge', 'Windows', $3) returning id",
    [childId, `hash-offline-${counter}`, lastSeen],
  );
}

async function found(db: Db, now: string, among: string[]): Promise<string[]> {
  const res = await attempt(db, "service", "select * from public.find_offline_devices($1::timestamptz)", [now]);
  if (!res.ok) throw new Error(`find_offline_devices failed: ${res.message}`);
  const ids = res.rows.map((r) => String(r.device_id ?? r.id));
  return among.filter((id) => ids.includes(id));
}

const addAlert = (db: Db, deviceId: string, incident: string, emailedAt: string | null = null) =>
  db.query("insert into alerts (device_id, kind, incident_last_seen_at, emailed_at) values ($1, 'offline', $2, $3)", [
    deviceId,
    incident,
    emailedAt,
  ]);

describe("offline alerts migration", () => {
  let db: Db;
  let fam: Awaited<ReturnType<typeof seedFamily>>;

  beforeAll(async () => {
    db = await createDb();
    fam = await seedFamily(db);
  });

  it("Silence thresholds", async () => {
    const d1459 = await device(db, await newChild(db, fam.familyId),14 * MINUTE + 59 * SECOND); // 14 min 59 s
    const d15 = await device(db, await newChild(db, fam.familyId),15 * MINUTE); // exactly 15 min
    const d2359 = await device(db, await newChild(db, fam.familyId),23 * HOUR + 59 * MINUTE); // 23 h 59 min
    const d24 = await device(db, await newChild(db, fam.familyId),24 * HOUR); // exactly 24 h
    const d24s = await device(db, await newChild(db, fam.familyId),24 * HOUR + SECOND); // 24 h 1 s
    const never = await device(db, await newChild(db, fam.familyId),null);

    const all = [d1459, d15, d2359, d24, d24s, never];
    expect(await found(db, NOW, all)).toEqual([d15, d2359, d24]);
  });

  it("One incident is recorded once", async () => {
    const d = await device(db, await newChild(db, fam.familyId),20 * MINUTE); // last seen 11:40:00
    const lastSeen = "2026-11-17T11:40:00Z";
    await addAlert(db, d, lastSeen);
    expect(await found(db, NOW, [d])).toEqual([]);

    // device reports again at 11:55, then is silent for 15 min (12:10)
    await db.query("update devices set last_seen_at = $2 where id = $1", [d, "2026-11-17T11:55:00Z"]);
    expect(await found(db, "2026-11-17T12:09:59Z", [d])).toEqual([]); // 14 min 59 s
    expect(await found(db, "2026-11-17T12:10:00Z", [d])).toEqual([d]); // 11:55 + 15 min
  });

  it("Function and table access", async () => {
    const d = await device(db, await newChild(db, fam.familyId),20 * MINUTE);
    for (const role of ["anon", { parent: fam.userId }] as const) {
      const find = await attempt(db, role, "select * from public.find_offline_devices($1::timestamptz)", [NOW]);
      expect(find.ok).toBe(false);
      expect(!find.ok && find.code).toBe(PERMISSION_DENIED);

      const call = await attempt(db, role, "select public.call_offline_alerts()");
      expect(call.ok).toBe(false);
      expect(!call.ok && call.code).toBe(PERMISSION_DENIED);

      const insert = await attempt(
        db,
        role,
        "insert into alerts (device_id, kind, incident_last_seen_at) values ($1, 'offline', $2)",
        [d, "2026-11-17T11:40:00Z"],
      );
      expect(insert.ok).toBe(false);
      expect(!insert.ok && insert.code).toBe(PERMISSION_DENIED);
    }
    expect((await attempt(db, "service", "select * from public.find_offline_devices($1::timestamptz)", [NOW])).ok).toBe(true);
  });

  it("Duplicate claim rejected", async () => {
    const d = await device(db, await newChild(db, fam.familyId),20 * MINUTE);
    await addAlert(db, d, "2026-11-17T11:40:00Z");
    const second = await attempt(
      db,
      "service",
      "insert into alerts (device_id, kind, incident_last_seen_at) values ($1, 'offline', $2)",
      [d, "2026-11-17T11:40:00Z"],
    );
    expect(second.ok).toBe(false);
    expect(!second.ok && second.code).toBe(UNIQUE_VIOLATION);
  });

  it("Silent browser covered by an active browser", async () => {
    const child = await newChild(db, fam.familyId);
    const chrome = await device(db, child, 2 * MINUTE);
    const firefox = await device(db, child, 3 * HOUR);
    expect(await found(db, NOW, [chrome, firefox])).toEqual([]);
  });

  it("Every browser silent", async () => {
    const child = await newChild(db, fam.familyId);
    const chrome = await device(db, child, 20 * MINUTE);
    const firefox = await device(db, child, 3 * HOUR);
    expect(await found(db, NOW, [chrome, firefox])).toEqual([chrome, firefox]);
  });

  it("Sibling reported before the silent device", async () => {
    const child = await newChild(db, fam.familyId);
    const chrome = await device(db, child, 2 * HOUR);
    const firefox = await device(db, child, 20 * MINUTE);
    expect(await found(db, NOW, [chrome, firefox])).toEqual([chrome, firefox]);
  });

  it("Single device child unchanged", async () => {
    const single = await device(db, await newChild(db, fam.familyId), 20 * MINUTE);
    const other = await device(db, await newChild(db, fam.familyId), MINUTE);
    expect(await found(db, NOW, [single, other])).toEqual([single]);
  });

  it("Another child's activity does not cover", async () => {
    const firefox = await device(db, await newChild(db, fam.familyId), 3 * HOUR);
    const chromeOfB = await device(db, await newChild(db, fam.familyId), 2 * MINUTE);
    expect(await found(db, NOW, [firefox, chromeOfB])).toEqual([firefox]);
  });

  it("Migration loads without cron extensions", async () => {
    // createDb applied every migration on a database without pg_cron, pg_net and vault
    const names = (
      await db.query<{ proname: string }>(
        "select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'",
      )
    ).rows.map((r) => r.proname);
    expect(names).toContain("call_offline_alerts");
    expect(names).toContain("find_offline_devices");
    const cols = (
      await db.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_name = 'alerts' and table_schema = 'public'",
      )
    ).rows.map((r) => r.column_name);
    expect(cols).toEqual(expect.arrayContaining(["incident_last_seen_at", "emailed_at"]));
  });

  describe("call_offline_alerts with stubbed Vault and pg_net", () => {
    beforeAll(async () => {
      await db.exec(`
        create schema vault;
        create table vault.decrypted_secrets (name text, decrypted_secret text);
        create schema net;
        create table net.calls (url text, headers jsonb, body jsonb, timeout_milliseconds integer);
        create function net.http_post(
          url text,
          body jsonb default '{}'::jsonb,
          params jsonb default '{}'::jsonb,
          headers jsonb default '{"Content-Type": "application/json"}'::jsonb,
          timeout_milliseconds integer default 5000
        ) returns bigint language plpgsql as $$
        begin
          insert into net.calls values (url, headers, body, timeout_milliseconds);
          return 1;
        end $$;
      `);
    });

    it("Missing Vault secrets", async () => {
      await db.exec("delete from vault.decrypted_secrets; delete from net.calls");
      const notices: string[] = [];
      await db.query("select public.call_offline_alerts()", [], { onNotice: (n) => notices.push(`${n.severity}:${n.message}`) });
      expect(notices.some((n) => n.startsWith("WARNING"))).toBe(true);
      expect(await scalar<number>(db, "select count(*)::int from net.calls")).toBe(0);

      // one of the two missing is still a no-op
      await db.exec("insert into vault.decrypted_secrets values ('app_url', 'https://app.example.test')");
      await db.query("select public.call_offline_alerts()");
      expect(await scalar<number>(db, "select count(*)::int from net.calls")).toBe(0);
    });

    it("Request timeout", async () => {
      await db.exec("delete from vault.decrypted_secrets; delete from net.calls");
      await db.exec(
        "insert into vault.decrypted_secrets values ('app_url', 'https://app.example.test'), ('alert_cron_secret', 's3cret')",
      );
      await db.query("select public.call_offline_alerts()");

      const calls = await db.query<{ url: string; headers: Record<string, string>; timeout_milliseconds: number }>(
        "select url, headers, timeout_milliseconds from net.calls",
      );
      expect(calls.rows).toHaveLength(1);
      expect(calls.rows[0]!.timeout_milliseconds).toBe(10000);
      expect(calls.rows[0]!.url).toBe("https://app.example.test/api/alerts/offline");
      expect(calls.rows[0]!.headers.Authorization).toBe("Bearer s3cret");
    });
  });

  // The cron jobs cannot run on PGlite: check what the migration schedules and that it is guarded.
  const offlineSql = () =>
    migrationFiles()
      .filter((f) => /offline_alerts/.test(f))
      .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
      .join("\n");

  it("Cron wiring on production", () => {
    const sql = offlineSql();
    expect(sql).toMatch(/cron\.schedule\(\s*'offline-alerts'\s*,\s*'\*\/5 \* \* \* \*'/);
    expect(sql).toContain("call_offline_alerts()");
    expect(sql).toMatch(/pg_cron/);
  });

  it("Migration still loads and keeps the purge function", async () => {
    const n = await scalar<number>(
      db,
      "select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname = 'purge_pair_attempts'",
    );
    expect(n).toBe(1);
  });

  it("Purge job on production", () => {
    expect(offlineSql()).toMatch(
      /cron\.schedule\(\s*'purge-pair-attempts'\s*,\s*'17 3 \* \* \*'\s*,\s*'select public\.purge_pair_attempts\(\)'/,
    );
  });
});
