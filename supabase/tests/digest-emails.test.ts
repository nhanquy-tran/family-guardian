import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, MIGRATIONS_DIR, migrationFiles, type Db } from "./harness";

const PERMISSION_DENIED = "42501";
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

let counter = 0;

async function seedDevice(db: Db, childId: string, lastSeenAt: string): Promise<string> {
  counter += 1;
  return scalar<string>(
    db,
    "insert into devices (child_id, token_hash, browser, os, last_seen_at) values ($1, $2, 'edge', 'Windows', $3) returning id",
    [childId, `hash-digest-${counter}`, lastSeenAt],
  );
}

const claim = (db: Db, familyId: string, frequency: string, periodStart: string) =>
  attempt(db, "service", "insert into digest_runs (family_id, frequency, period_start) values ($1, $2, $3)", [
    familyId,
    frequency,
    periodStart,
  ]);

describe("digest emails migration", () => {
  let db: Db;
  let a: { userId: string; familyId: string };
  let b: { userId: string; familyId: string };

  beforeAll(async () => {
    db = await createDb();
    a = await createUser(db, "Parent A");
    b = await createUser(db, "Parent B");
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

  it("Defaults and checks", async () => {
    const row = (
      await db.query<{ timezone: string; timezone_known: boolean; digest_frequency: string; digest_hour: number }>(
        "select timezone, timezone_known, digest_frequency, digest_hour from families where id = $1",
        [a.familyId],
      )
    ).rows[0];
    expect(row).toEqual({ timezone: "UTC", timezone_known: false, digest_frequency: "daily", digest_hour: 8 });

    const monthly = await attempt(db, { parent: a.userId }, "update families set digest_frequency = 'monthly' where id = $1", [a.familyId]);
    expect(monthly.ok).toBe(false);
    expect(!monthly.ok && monthly.code).toBe(CHECK_VIOLATION);

    for (const hour of [24, -1]) {
      const bad = await attempt(db, { parent: a.userId }, "update families set digest_hour = $2 where id = $1", [a.familyId, hour]);
      expect(bad.ok, String(hour)).toBe(false);
      expect(!bad.ok && bad.code, String(hour)).toBe(CHECK_VIOLATION);
    }
  });

  it("unfiltered settings updates touch only the caller's family", async () => {
    const before = await db.query("select digest_frequency, digest_hour, timezone, timezone_known, weekly_report_enabled from families where id = $1", [
      b.familyId,
    ]);
    const statements = [
      "update families set timezone = 'Asia/Tokyo', timezone_known = true where timezone_known = false returning id",
      "update families set digest_frequency = 'weekly', digest_hour = 7, timezone = 'Europe/Zurich', timezone_known = true returning id",
      "update families set weekly_report_enabled = true returning id",
    ];
    for (const sql of statements) {
      const r = await attempt(db, { parent: a.userId }, sql);
      expect(r.ok && r.rows, sql).toEqual([{ id: a.familyId }]);
    }
    const after = await db.query("select digest_frequency, digest_hour, timezone, timezone_known, weekly_report_enabled from families where id = $1", [
      b.familyId,
    ]);
    expect(after.rows).toEqual(before.rows);
    await db.query(
      "update families set digest_frequency = 'daily', digest_hour = 8, timezone = 'UTC', timezone_known = false, weekly_report_enabled = false where id = $1",
      [a.familyId],
    );
  });

  it("Parents edit only their own family", async () => {
    const own = await attempt(db, { parent: a.userId }, "update families set digest_hour = 6 where id = $1", [a.familyId]);
    expect(own.ok && own.affected).toBe(1);

    const other = await attempt(db, { parent: a.userId }, "update families set digest_hour = 5 where id = $1", [b.familyId]);
    expect(other.ok && other.affected).toBe(0);
    expect(await scalar<number>(db, "select digest_hour from families where id = $1", [b.familyId])).toBe(8);

    const runs = await attempt(db, { parent: a.userId }, "select * from digest_runs");
    expect(runs.ok).toBe(false);
    expect(!runs.ok && runs.code).toBe(PERMISSION_DENIED);
    const write = await attempt(
      db,
      { parent: a.userId },
      "insert into digest_runs (family_id, frequency, period_start) values ($1, 'daily', '2026-11-09')",
      [a.familyId],
    );
    expect(write.ok).toBe(false);
    expect(!write.ok && write.code).toBe(PERMISSION_DENIED);
    const anon = await attempt(db, "anon", "select * from digest_runs");
    expect(anon.ok).toBe(false);
    expect(!anon.ok && anon.code).toBe(PERMISSION_DENIED);
  });

  it("One claim per family, frequency and period", async () => {
    expect((await claim(db, a.familyId, "daily", "2026-11-09")).ok).toBe(true);

    const again = await claim(db, a.familyId, "daily", "2026-11-09");
    expect(again.ok).toBe(false);
    expect(!again.ok && again.code).toBe(UNIQUE_VIOLATION);

    expect((await claim(db, a.familyId, "weekly", "2026-11-09")).ok).toBe(true);
    const read = await attempt(db, "service", "select count(*)::int as n from digest_runs where family_id = $1", [a.familyId]);
    expect(read.ok && read.rows[0]?.n).toBe(2);
  });

  it("Migration loads and Vault handling", async () => {
    // createDb applied every migration on a database without pg_cron, pg_net and vault
    const names = (
      await db.query<{ proname: string }>(
        "select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'",
      )
    ).rows.map((r) => r.proname);
    expect(names).toEqual(expect.arrayContaining(["call_send_digests", "purge_digest_runs", "resolve_offline_alerts"]));

    for (const role of ["anon", { parent: a.userId }] as const) {
      for (const sql of [
        "select public.call_send_digests()",
        "select public.purge_digest_runs()",
        "select public.resolve_offline_alerts(now())",
      ]) {
        const res = await attempt(db, role, sql);
        expect(res.ok, sql).toBe(false);
        expect(!res.ok && res.code, sql).toBe(PERMISSION_DENIED);
      }
    }

    await db.exec("delete from vault.decrypted_secrets; delete from net.calls");
    const notices: string[] = [];
    await db.query("select public.call_send_digests()", [], { onNotice: (n) => notices.push(`${n.severity}:${n.message}`) });
    expect(notices.some((n) => n.startsWith("WARNING"))).toBe(true);
    expect(await scalar<number>(db, "select count(*)::int from net.calls")).toBe(0);

    await db.exec(
      "insert into vault.decrypted_secrets values ('app_url', 'https://app.example.test'), ('alert_cron_secret', 's3cret')",
    );
    await db.query("select public.call_send_digests()");
    const calls = await db.query<{ url: string; headers: Record<string, string>; timeout_milliseconds: number }>(
      "select url, headers, timeout_milliseconds from net.calls",
    );
    expect(calls.rows).toHaveLength(1);
    expect(calls.rows[0]!.timeout_milliseconds).toBe(10000);
    expect(calls.rows[0]!.url).toBe("https://app.example.test/api/digest/send");
    expect(calls.rows[0]!.headers.Authorization).toBe("Bearer s3cret");
  });

  it("Purge", async () => {
    await db.exec("delete from digest_runs");
    await db.query(
      "insert into digest_runs (family_id, frequency, period_start, claimed_at) values ($1, 'daily', '2026-08-01', now() - interval '91 days'), ($1, 'daily', '2026-08-02', now() - interval '89 days')",
      [a.familyId],
    );
    const res = await attempt(db, "service", "select public.purge_digest_runs()");
    expect(res.ok).toBe(true);
    const left = await db.query<{ period_start: string }>("select period_start::text as period_start from digest_runs");
    expect(left.rows.map((r) => r.period_start)).toEqual(["2026-08-02"]);
  });

  it("Purge removes report claims", async () => {
    await db.exec("delete from digest_runs");
    await db.query(
      "insert into digest_runs (family_id, frequency, period_start, claimed_at) values ($1, 'weekly_report', '2026-08-03', now() - interval '91 days'), ($1, 'weekly_report', '2026-08-10', now() - interval '89 days')",
      [a.familyId],
    );
    const res = await attempt(db, "service", "select public.purge_digest_runs()");
    expect(res.ok).toBe(true);
    const left = await db.query<{ period_start: string }>("select period_start::text as period_start from digest_runs");
    expect(left.rows.map((r) => r.period_start)).toEqual(["2026-08-10"]);
  });

  it("Returned device resolves its incident", async () => {
    const childId = await scalar<string>(db, "insert into children (family_id, name) values ($1, 'Mia') returning id", [a.familyId]);
    const returned = await seedDevice(db, childId, "2026-11-17T11:55:00Z");
    const stillOff = await seedDevice(db, childId, "2026-11-17T11:40:00Z");
    for (const device of [returned, stillOff]) {
      await db.query("insert into alerts (device_id, kind, incident_last_seen_at) values ($1, 'offline', '2026-11-17T11:40:00Z')", [device]);
    }
    const resolvedAt = (device: string) =>
      db
        .query<{ r: string | null }>("select resolved_at as r from alerts where device_id = $1", [device])
        .then((x) => (x.rows[0]!.r === null ? null : new Date(x.rows[0]!.r).toISOString()));

    const first = await attempt(db, "service", "select public.resolve_offline_alerts($1::timestamptz)", ["2026-11-17T12:00:00Z"]);
    expect(first.ok).toBe(true);
    expect(await resolvedAt(returned)).toBe("2026-11-17T12:00:00.000Z");
    expect(await resolvedAt(stillOff)).toBeNull();

    const second = await attempt(db, "service", "select public.resolve_offline_alerts($1::timestamptz)", ["2026-11-17T12:30:00Z"]);
    expect(second.ok).toBe(true);
    expect(await resolvedAt(returned)).toBe("2026-11-17T12:00:00.000Z");
    expect(await resolvedAt(stillOff)).toBeNull();
  });

  // pg_cron cannot run on PGlite: check what the migration schedules and that it is guarded.
  const digestSql = () =>
    migrationFiles()
      .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
      .filter((sql) => sql.includes("call_send_digests"))
      .join("\n");

  it("Cron wiring on production", () => {
    const sql = digestSql();
    expect(sql).toMatch(/cron\.schedule\(\s*'send-digests'\s*,\s*'\*\/15 \* \* \* \*'/);
    expect(sql).toContain("select public.call_send_digests()");
    expect(sql).toMatch(/cron\.schedule\(\s*'purge-digest-runs'\s*,\s*'[^']+'\s*,\s*'select public\.purge_digest_runs\(\)'/);
    expect(sql).toMatch(/pg_available_extensions/);
  });
});
