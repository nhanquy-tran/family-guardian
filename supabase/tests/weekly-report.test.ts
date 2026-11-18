import { beforeAll, describe, expect, it } from "vitest";
import { attempt, createDb, createUser, type Db } from "./harness";

const PERMISSION_DENIED = "42501";

async function scalar<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0] as Record<string, unknown>)[0] as T;
}

let counter = 0;

async function seedChild(db: Db, familyId: string, name: string): Promise<{ childId: string; deviceId: string }> {
  counter += 1;
  const childId = await scalar<string>(db, "insert into children (family_id, name) values ($1, $2) returning id", [familyId, name]);
  const deviceId = await scalar<string>(
    db,
    "insert into devices (child_id, token_hash, browser, os) values ($1, $2, 'edge', 'Windows') returning id",
    [childId, `hash-weekly-${counter}`],
  );
  return { childId, deviceId };
}

const addUsage = (db: Db, deviceId: string, at: string, domain: string, seconds: number) =>
  db.query("insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, $2, $3, $4)", [deviceId, at, domain, seconds]);

const totals = (db: Db, as: { parent: string } | "anon" | "service", childIds: string[], start: string, end: string) =>
  attempt(
    db,
    as,
    "select child_id, seconds::int as seconds from public.usage_total_seconds($1::uuid[], $2::timestamptz, $3::timestamptz)",
    [`{${childIds.join(",")}}`, start, end],
  );

describe("weekly report migration", () => {
  let db: Db;
  let a: { userId: string; familyId: string };
  let b: { userId: string; familyId: string };

  beforeAll(async () => {
    db = await createDb();
    a = await createUser(db, "Parent A");
    b = await createUser(db, "Parent B");
  });

  it("Default and own-family edit", async () => {
    const fresh = await createUser(db, "Parent C");
    expect(await scalar<boolean>(db, "select weekly_report_enabled from families where id = $1", [fresh.familyId])).toBe(false);

    const own = await attempt(db, { parent: a.userId }, "update families set weekly_report_enabled = true where id = $1", [a.familyId]);
    expect(own.ok && own.affected).toBe(1);
    expect(await scalar<boolean>(db, "select weekly_report_enabled from families where id = $1", [a.familyId])).toBe(true);

    const other = await attempt(db, { parent: a.userId }, "update families set weekly_report_enabled = true where id = $1", [b.familyId]);
    expect(other.ok && other.affected).toBe(0);
    expect(await scalar<boolean>(db, "select weekly_report_enabled from families where id = $1", [b.familyId])).toBe(false);
  });

  it("Totals per child in the period", async () => {
    const one = await seedChild(db, a.familyId, "Mia");
    const two = await seedChild(db, a.familyId, "Leo");
    // 60 + 30 inside [11-09, 11-16); the 99 s at the end instant is outside. seconds is capped at 60 per row,
    // so the 99 s are two rows (60 + 39) in the same minute on different domains.
    await addUsage(db, one.deviceId, "2026-11-09T10:00:00Z", "example.com", 60);
    await addUsage(db, one.deviceId, "2026-11-15T23:59:00Z", "example.com", 30);
    await addUsage(db, one.deviceId, "2026-11-16T00:00:00Z", "example.com", 60);
    await addUsage(db, one.deviceId, "2026-11-16T00:00:00Z", "other.example.com", 39);

    const res = await totals(db, "service", [one.childId, two.childId], "2026-11-09T00:00:00Z", "2026-11-16T00:00:00Z");
    expect(res.ok).toBe(true);
    const rows = res.ok ? (res.rows as { child_id: string; seconds: number }[]) : [];
    expect(rows.find((r) => r.child_id === one.childId)?.seconds).toBe(90);
    expect(rows.find((r) => r.child_id === two.childId)?.seconds ?? 0).toBe(0);
  });

  it("Totals are not callable by parents", async () => {
    const { childId } = await seedChild(db, a.familyId, "Zed");
    for (const role of ["anon", { parent: a.userId }] as const) {
      const res = await totals(db, role, [childId], "2026-11-09T00:00:00Z", "2026-11-16T00:00:00Z");
      expect(res.ok).toBe(false);
      expect(!res.ok && res.code).toBe(PERMISSION_DENIED);
    }
    const config = await scalar<string[] | null>(db, "select proconfig from pg_proc where proname = 'usage_total_seconds'");
    expect(config?.join(",")).toContain('search_path=""');
  });
});
