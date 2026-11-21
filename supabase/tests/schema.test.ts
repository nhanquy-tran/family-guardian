import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, attempt, createDb, createUser, migrationFiles, type Db } from "./harness";

const TABLES = [
  "families",
  "parents",
  "children",
  "devices",
  "pairing_codes",
  "usage_minutes",
  "block_rules",
  "domain_categories",
  "block_events",
  "alerts",
];

const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const RLS_VIOLATION = "42501";

type Family = {
  userId: string;
  familyId: string;
  childId: string;
  childId2: string;
  deviceId: string;
  ruleId: string;
  code: string;
  categoryId: string;
};

const svc = "service" as const;

async function one(db: Db, sql: string, params: unknown[] = []): Promise<Record<string, unknown>> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return r.rows[0] as Record<string, unknown>;
}

async function seedFamily(db: Db, label: string, code: string): Promise<Family> {
  const { userId, familyId } = await createUser(db, `Parent ${label}`);
  const childId = (await one(db, "insert into children (family_id, name) values ($1, $2) returning id", [familyId, `Kid ${label}`])).id as string;
  const childId2 = (await one(db, "insert into children (family_id, name) values ($1, $2) returning id", [familyId, `Kid2 ${label}`])).id as string;
  const deviceId = (
    await one(db, "insert into devices (child_id, token_hash, browser, os) values ($1, $2, 'chrome', 'Windows') returning id", [
      childId,
      `hash-${label}-${userId}`,
    ])
  ).id as string;
  const ruleId = (await one(db, "insert into block_rules (child_id, kind, value) values ($1, 'domain', $2) returning id", [childId, `blocked-${label.toLowerCase()}.com`])).id as string;
  await db.query("insert into pairing_codes (code, child_id, expires_at) values ($1, $2, now() + interval '1 hour')", [code, childId]);
  await db.query("insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, '2026-11-17T09:00:00Z', 'example.com', 30)", [deviceId]);
  await db.query("insert into block_events (device_id, domain) values ($1, 'tiktok.com')", [deviceId]);
  await db.query("insert into alerts (device_id, kind, incident_last_seen_at) values ($1, 'offline', now())", [deviceId]);
  const categoryId = (
    await one(db, "insert into domain_categories (family_id, domain, category) values ($1, $2, 'games') returning id", [familyId, `override-${label.toLowerCase()}.com`])
  ).id as string;
  return { userId, familyId, childId, childId2, deviceId, ruleId, code, categoryId };
}

async function makeChildAndDevice(db: Db, familyId: string, label: string) {
  const childId = (await one(db, "insert into children (family_id, name) values ($1, $2) returning id", [familyId, label])).id as string;
  const deviceId = (
    await one(db, "insert into devices (child_id, token_hash, browser, os) values ($1, $2, 'chrome', 'Windows') returning id", [childId, `hash-${label}-${childId}`])
  ).id as string;
  return { childId, deviceId };
}

describe("migration creates the MVP tables", () => {
  let db: Db;
  let applyError: unknown = null;

  beforeAll(async () => {
    try {
      db = await createDb();
    } catch (error) {
      applyError = error;
    }
  });

  it("all tables exist", async () => {
    expect(applyError).toBeNull();
    const res = await db.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema = 'public'");
    const names = res.rows.map((r) => r.table_name);
    for (const t of TABLES) expect(names).toContain(t);
    expect(TABLES).toHaveLength(10);
  });

  it("migration file naming", () => {
    const files = migrationFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(f).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
  });
});

describe("schema constraints and triggers", () => {
  let db: Db;
  let fam: Family;

  beforeAll(async () => {
    db = await createDb();
    fam = await seedFamily(db, "Base", "BASE01");
  });
  afterAll(async () => {
    await db?.close();
  });

  it("primary key columns", async () => {
    const res = await db.query<{ attname: string }>(
      `select a.attname
         from pg_index i
         join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
        where i.indrelid = 'public.usage_minutes'::regclass and i.indisprimary
        order by array_position(i.indkey::int2[], a.attnum)`,
    );
    expect(res.rows.map((r) => r.attname)).toEqual(["device_id", "minute_utc", "domain"]);
  });

  it("upsert does not duplicate", async () => {
    const minute = "2026-11-17T10:00:00Z";
    const first = await attempt(db, svc, "insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, $2, 'youtube.com', 30)", [fam.deviceId, minute]);
    expect(first.ok).toBe(true);
    const second = await attempt(
      db,
      svc,
      `insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, $2, 'youtube.com', 45)
       on conflict (device_id, minute_utc, domain) do update set seconds = excluded.seconds`,
      [fam.deviceId, minute],
    );
    expect(second.ok).toBe(true);
    const rows = await db.query<{ seconds: number }>("select seconds from usage_minutes where device_id = $1 and minute_utc = $2 and domain = 'youtube.com'", [fam.deviceId, minute]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.seconds).toBe(45);
  });

  it("URL or path rejected as domain", async () => {
    for (const domain of ["https://youtube.com/watch?v=x", "youtube.com/watch", "YouTube.com", ""]) {
      const r = await attempt(db, svc, "insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, '2026-11-17T11:00:00Z', $2, 10)", [fam.deviceId, domain]);
      expect(r.ok, `domain ${JSON.stringify(domain)}`).toBe(false);
      if (!r.ok) expect(r.code).toBe(CHECK_VIOLATION);
    }
  });

  it("block event domain checked too", async () => {
    const bad = await attempt(db, svc, "insert into block_events (device_id, domain) values ($1, 'tiktok.com/@user')", [fam.deviceId]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe(CHECK_VIOLATION);
    const good = await attempt(db, svc, "insert into block_events (device_id, domain) values ($1, 'tiktok.com')", [fam.deviceId]);
    expect(good.ok).toBe(true);
  });

  it("seconds bounds", async () => {
    for (const s of [0, 61]) {
      const r = await attempt(db, svc, "insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, '2026-11-17T12:00:00Z', 'example.org', $2)", [fam.deviceId, s]);
      expect(r.ok, `seconds ${s}`).toBe(false);
    }
    for (const [i, s] of [1, 60].entries()) {
      const r = await attempt(db, svc, "insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, $2, 'example.org', $3)", [fam.deviceId, `2026-11-17T12:0${i + 1}:00Z`, s]);
      expect(r.ok, `seconds ${s}`).toBe(true);
    }
  });

  it("whole minutes only", async () => {
    const r = await attempt(db, svc, "insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, '2026-11-17T10:00:30Z', 'example.net', 10)", [fam.deviceId]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(CHECK_VIOLATION);
  });

  it("invalid enum values rejected", async () => {
    const statements: [string, string, unknown[]][] = [
      ["device browser", "insert into devices (child_id, token_hash, browser, os) values ($1, 'h-ff', 'netscape', 'Windows')", [fam.childId]],
      ["block rule kind", "insert into block_rules (child_id, kind, value) values ($1, 'url', 'x.com')", [fam.childId]],
      ["pairing code", "insert into pairing_codes (code, child_id, expires_at) values ('abc123', $1, now() + interval '1 hour')", [fam.childId]],
      ["child homework category", "insert into children (family_id, name, homework_categories) values ($1, 'Z', '{homework}')", [fam.familyId]],
      ["domain category", "insert into domain_categories (family_id, domain, category) values (null, 'spotify.com', 'music')", []],
      ["alert kind", "insert into alerts (device_id, kind, incident_last_seen_at) values ($1, 'other', now())", [fam.deviceId]],
    ];
    for (const [label, sql, params] of statements) {
      const r = await attempt(db, svc, sql, params);
      expect(r.ok, label).toBe(false);
      if (!r.ok) expect(r.code, label).toBe(CHECK_VIOLATION);
    }
  });

  it("valid values accepted", async () => {
    const statements: [string, string, unknown[]][] = [
      ["device browser", "insert into devices (child_id, token_hash, browser, os) values ($1, 'h-edge', 'edge', 'Windows')", [fam.childId]],
      ["device browser firefox", "insert into devices (child_id, token_hash, browser, os) values ($1, 'h-firefox', 'firefox', 'Windows')", [fam.childId]],
      ["block rule", "insert into block_rules (child_id, kind, value) values ($1, 'category', 'games')", [fam.childId]],
      ["pairing code", "insert into pairing_codes (code, child_id, expires_at) values ('AB12CD', $1, now() + interval '1 hour')", [fam.childId]],
      ["child", "insert into children (family_id, name, homework_categories) values ($1, 'Okay', '{education,productivity}')", [fam.familyId]],
      ["alert", "insert into alerts (device_id, kind, incident_last_seen_at) values ($1, 'offline', now())", [fam.deviceId]],
    ];
    for (const [label, sql, params] of statements) {
      const r = await attempt(db, svc, sql, params);
      expect(r.ok, label).toBe(true);
    }
  });

  it("Firefox migration only changes the check", () => {
    const file = migrationFiles().find((f) => f.endsWith("_firefox_browser.sql"));
    expect(file).toBeDefined();
    const sql = readFileSync(join(__dirname, "..", "migrations", file ?? ""), "utf8").toLowerCase();
    for (const word of ["update", "delete", "truncate", "grant", "revoke"]) {
      expect(sql, word).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
    expect(sql).toMatch(/drop constraint[^;]*devices_browser_check/);
    expect(sql).toMatch(/add constraint\s+devices_browser_check[^;]*firefox/);
  });

  it("new user gets a family", async () => {
    const { userId } = await createUser(db, "Lan Nguyen");
    const parents = await db.query<{ family_id: string }>("select family_id from parents where user_id = $1", [userId]);
    expect(parents.rows).toHaveLength(1);
    const family = await db.query<{ name: string }>("select name from families where id = $1", [parents.rows[0]?.family_id]);
    expect(family.rows).toHaveLength(1);
    expect(family.rows[0]?.name).toBe("Lan Nguyen");
  });

  it("missing name", async () => {
    const { familyId } = await createUser(db);
    const family = await one(db, "select name from families where id = $1", [familyId]);
    expect(family.name).toBe("My family");
  });

  it("two users get two families", async () => {
    const a = await createUser(db, "One");
    const b = await createUser(db, "Two");
    expect(a.familyId).not.toBe("");
    expect(b.familyId).not.toBe("");
    expect(a.familyId).not.toBe(b.familyId);
  });

  it("deleting the user removes the parent row", async () => {
    const { userId } = await createUser(db, "Gone");
    expect((await db.query("select 1 from parents where user_id = $1", [userId])).rows).toHaveLength(1);
    await db.query("delete from auth.users where id = $1", [userId]);
    expect((await db.query("select 1 from parents where user_id = $1", [userId])).rows).toHaveLength(0);
  });

  it("catalog check", async () => {
    const res = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname = any($1)",
      [TABLES],
    );
    expect(res.rows).toHaveLength(10);
    for (const row of res.rows) expect(row.relrowsecurity, row.relname).toBe(true);
  });

  it("service role writes device data", async () => {
    const { childId } = await makeChildAndDevice(db, fam.familyId, "svc-kid");
    const dev = await attempt(db, svc, "insert into devices (child_id, token_hash, browser, os) values ($1, 'svc-h', 'brave', 'Windows') returning id", [childId]);
    expect(dev.ok).toBe(true);
    const deviceId = dev.ok ? (dev.rows[0]?.id as string) : "";
    expect((await attempt(db, svc, "insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, '2026-11-17T13:00:00Z', 'example.com', 5)", [deviceId])).ok).toBe(true);
    expect((await attempt(db, svc, "insert into block_events (device_id, domain) values ($1, 'example.com')", [deviceId])).ok).toBe(true);
    expect((await attempt(db, svc, "insert into alerts (device_id, kind, incident_last_seen_at) values ($1, 'offline', now())", [deviceId])).ok).toBe(true);
    expect((await attempt(db, svc, "update devices set last_seen_at = now() where id = $1", [deviceId])).ok).toBe(true);
  });
});

describe("row level security", () => {
  let db: Db;
  let a: Family;
  let b: Family;
  let globalCategoryId: string;

  beforeAll(async () => {
    db = await createDb();
    a = await seedFamily(db, "A", "AAAAAA");
    b = await seedFamily(db, "B", "BBBBBB");
    globalCategoryId = (await one(db, "insert into domain_categories (family_id, domain, category) values (null, 'global.com', 'news') returning id")).id as string;
  });
  afterAll(async () => {
    await db?.close();
  });

  const parentA = () => ({ parent: a.userId });
  const parentB = () => ({ parent: b.userId });

  async function selectAll(table: string, who: { parent: string } | "anon") {
    return attempt(db, who, `select * from ${table === "devices" ? "(select id, child_id from devices) d" : table}`);
  }

  it("anonymous sees nothing", async () => {
    for (const t of TABLES) {
      const r = await selectAll(t, "anon");
      if (r.ok) expect(r.rows, t).toHaveLength(0);
    }
    const inserts: [string, unknown[]][] = [
      ["insert into families (name) values ('x')", []],
      ["insert into children (family_id, name) values ($1, 'x')", [a.familyId]],
      ["insert into block_rules (child_id, kind, value) values ($1, 'domain', 'x.com')", [a.childId]],
      ["insert into pairing_codes (code, child_id, expires_at) values ('ANON01', $1, now() + interval '1 hour')", [a.childId]],
      ["insert into domain_categories (family_id, domain, category) values (null, 'anon.com', 'games')", []],
      ["insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, '2026-11-17T14:00:00Z', 'anon.com', 5)", [a.deviceId]],
      ["insert into block_events (device_id, domain) values ($1, 'anon.com')", [a.deviceId]],
      ["insert into alerts (device_id, kind, incident_last_seen_at) values ($1, 'offline', now())", [a.deviceId]],
      ["insert into devices (child_id, token_hash, browser, os) values ($1, 'anon-h', 'chrome', 'Windows')", [a.childId]],
      ["insert into parents (user_id, family_id) values (gen_random_uuid(), $1)", [a.familyId]],
    ];
    for (const [sql, params] of inserts) {
      const r = await attempt(db, "anon", sql, params);
      expect(r.ok, sql).toBe(false);
    }
  });

  it("anonymous cannot change or delete rows", async () => {
    await db.query("insert into child_category_limits (child_id, category, minutes_per_day) values ($1, 'games', 60)", [a.childId]);
    const statements: [string, unknown[]][] = [
      ["update families set digest_hour = 5, weekly_report_enabled = true", []],
      ["update families set timezone = 'Asia/Tokyo', timezone_known = true where timezone_known = false", []],
      ["update children set name = 'Anon' where id = $1", [a.childId]],
      ["update children set allowed_start = '08:00', allowed_end = '20:00', homework_domains = '{anon.example.org}' where id = $1", [a.childId]],
      ["delete from children where id = $1", [a.childId2]],
      ["delete from block_rules where id = $1", [a.ruleId]],
      ["delete from pairing_codes where child_id = $1", [a.childId]],
      ["update domain_categories set category = 'news' where id = $1", [a.categoryId]],
      ["delete from domain_categories where id = $1", [a.categoryId]],
      ["update devices set name = 'Anon' where id = $1", [a.deviceId]],
      ["delete from devices where id = $1", [a.deviceId]],
      ["update child_category_limits set minutes_per_day = 5 where child_id = $1", [a.childId]],
      ["delete from child_category_limits where child_id = $1", [a.childId]],
    ];
    for (const [sql, params] of statements) {
      const r = await attempt(db, "anon", sql, params);
      expect(r.ok ? r.affected : 0, sql).toBe(0);
    }
    const state = await asService(db, async () => ({
      family: (await db.query("select digest_hour, timezone, weekly_report_enabled from families where id = $1", [a.familyId])).rows[0],
      child: (await db.query("select name, allowed_start, homework_domains from children where id = $1", [a.childId])).rows[0],
      child2: (await db.query("select 1 from children where id = $1", [a.childId2])).rows.length,
      rule: (await db.query("select 1 from block_rules where id = $1", [a.ruleId])).rows.length,
      code: (await db.query("select 1 from pairing_codes where child_id = $1", [a.childId])).rows.length,
      category: (await db.query("select category from domain_categories where id = $1", [a.categoryId])).rows[0],
      device: (await db.query("select name from devices where id = $1", [a.deviceId])).rows[0],
      limit: (await db.query("select minutes_per_day from child_category_limits where child_id = $1", [a.childId])).rows[0],
    }));
    expect(state).toEqual({
      family: { digest_hour: 8, timezone: "UTC", weekly_report_enabled: false },
      child: { name: "Kid A", allowed_start: null, homework_domains: [] },
      child2: 1,
      rule: 1,
      code: 1,
      category: { category: "games" },
      device: { name: null },
      limit: { minutes_per_day: 60 },
    });
    await db.query("delete from child_category_limits where child_id = $1", [a.childId]);
  });

  it("parent A reads only family A", async () => {
    const owner: Record<string, (id: string) => string> = {
      families: () => "select id from families",
      parents: () => "select family_id as id from parents",
      children: () => "select family_id as id from children",
      devices: () => "select c.family_id as id from (select id, child_id from devices) d join children c on c.id = d.child_id",
      pairing_codes: () => "select c.family_id as id from pairing_codes p join children c on c.id = p.child_id",
      block_rules: () => "select c.family_id as id from block_rules r join children c on c.id = r.child_id",
      usage_minutes: () => "select c.family_id as id from usage_minutes u join (select id, child_id from devices) d on d.id = u.device_id join children c on c.id = d.child_id",
      block_events: () => "select c.family_id as id from block_events e join (select id, child_id from devices) d on d.id = e.device_id join children c on c.id = d.child_id",
      alerts: () => "select c.family_id as id from alerts e join (select id, child_id from devices) d on d.id = e.device_id join children c on c.id = d.child_id",
    };
    for (const [table, q] of Object.entries(owner)) {
      const r = await attempt(db, parentA(), q(table));
      expect(r.ok, table).toBe(true);
      if (!r.ok) continue;
      expect(r.rows.length, table).toBeGreaterThan(0);
      for (const row of r.rows) expect(row.id, table).toBe(a.familyId);
    }
    const cats = await attempt(db, parentA(), "select id, family_id from domain_categories");
    expect(cats.ok).toBe(true);
    if (cats.ok) {
      expect(cats.rows.map((r) => r.id).sort()).toEqual([a.categoryId, globalCategoryId].sort());
      expect(cats.rows.some((r) => r.family_id === b.familyId)).toBe(false);
    }
  });

  it("device token hash is hidden from parents", async () => {
    const hash = await attempt(db, parentA(), "select token_hash from devices");
    expect(hash.ok).toBe(false);
    if (!hash.ok) expect(hash.code).toBe(RLS_VIOLATION);
    const cols = await attempt(db, parentA(), "select id, child_id, browser, os, last_seen_at, created_at from devices");
    expect(cols.ok).toBe(true);
    if (cols.ok) {
      expect(cols.rows.map((r) => r.id)).toEqual([a.deviceId]);
    }
  });

  it("write own family", async () => {
    const child = await attempt(db, parentA(), "insert into children (family_id, name) values ($1, 'New kid') returning id", [a.familyId]);
    expect(child.ok).toBe(true);
    const childId = child.ok ? (child.rows[0]?.id as string) : "";
    expect((await attempt(db, parentA(), "insert into block_rules (child_id, kind, value) values ($1, 'category', 'social')", [childId])).ok).toBe(true);
    expect((await attempt(db, parentA(), "insert into pairing_codes (code, child_id, expires_at) values ('OWN001', $1, now() + interval '1 hour')", [childId])).ok).toBe(true);
    expect((await attempt(db, parentA(), "insert into domain_categories (family_id, domain, category) values ($1, 'mine.com', 'social')", [a.familyId])).ok).toBe(true);
    const rename = await attempt(db, parentA(), "update families set name = 'Renamed A' where id = $1", [a.familyId]);
    expect(rename.ok && rename.affected).toBe(1);
    const extra = await makeChildAndDevice(db, a.familyId, "to-delete");
    const del = await attempt(db, parentA(), "delete from devices where id = $1", [extra.deviceId]);
    expect(del.ok && del.affected).toBe(1);

    const check = await asService(db, async () => ({
      child: (await db.query("select 1 from children where id = $1", [childId])).rows.length,
      rule: (await db.query("select 1 from block_rules where child_id = $1", [childId])).rows.length,
      code: (await db.query("select 1 from pairing_codes where code = 'OWN001'")).rows.length,
      cat: (await db.query("select 1 from domain_categories where domain = 'mine.com'")).rows.length,
      name: (await db.query<{ name: string }>("select name from families where id = $1", [a.familyId])).rows[0]?.name,
      dev: (await db.query("select 1 from devices where id = $1", [extra.deviceId])).rows.length,
    }));
    expect(check).toEqual({ child: 1, rule: 1, code: 1, cat: 1, name: "Renamed A", dev: 0 });
  });

  it("cannot write into another family", async () => {
    const statements: [string, unknown[]][] = [
      ["insert into children (family_id, name) values ($1, 'x')", [b.familyId]],
      ["insert into block_rules (child_id, kind, value) values ($1, 'domain', 'evil.com')", [b.childId]],
      ["insert into domain_categories (family_id, domain, category) values ($1, 'evil.com', 'games')", [b.familyId]],
      ["insert into domain_categories (family_id, domain, category) values (null, 'evil-global.com', 'games')", []],
    ];
    for (const [sql, params] of statements) {
      const r = await attempt(db, parentA(), sql, params);
      expect(r.ok, sql).toBe(false);
      if (!r.ok) expect(r.code, sql).toBe(RLS_VIOLATION);
    }
  });

  it("cannot change or delete another family's rows", async () => {
    const statements: [string, unknown[]][] = [
      ["update families set name = 'Hacked' where id = $1", [b.familyId]],
      ["update children set name = 'Hacked' where id = $1", [b.childId]],
      ["delete from block_rules where id = $1", [b.ruleId]],
      ["delete from devices where id = $1", [b.deviceId]],
    ];
    for (const [sql, params] of statements) {
      const r = await attempt(db, parentA(), sql, params);
      expect(r.ok && r.affected, sql).toBe(0);
    }
    const state = await asService(db, async () => ({
      family: (await db.query<{ name: string }>("select name from families where id = $1", [b.familyId])).rows[0]?.name,
      child: (await db.query<{ name: string }>("select name from children where id = $1", [b.childId])).rows[0]?.name,
      rule: (await db.query("select 1 from block_rules where id = $1", [b.ruleId])).rows.length,
      device: (await db.query("select 1 from devices where id = $1", [b.deviceId])).rows.length,
    }));
    expect(state).toEqual({ family: "Parent B", child: "Kid B", rule: 1, device: 1 });
  });

  it("cannot move a row to another family", async () => {
    const r = await attempt(db, parentA(), "update children set family_id = $1 where id = $2", [b.familyId, a.childId]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(RLS_VIOLATION);
  });

  it("parent creates a pairing code for their own child", async () => {
    const ins = await attempt(db, parentA(), "insert into pairing_codes (code, child_id, expires_at) values ('AB12CD', $1, now() + interval '1 hour')", [a.childId]);
    expect(ins.ok).toBe(true);
    const sel = await attempt(db, parentA(), "select code, child_id from pairing_codes where code = 'AB12CD'");
    expect(sel.ok && sel.rows).toEqual([{ code: "AB12CD", child_id: a.childId }]);
  });

  it("cannot create a pairing code for another family's child", async () => {
    const r = await attempt(db, parentA(), "insert into pairing_codes (code, child_id, expires_at) values ('XX99XX', $1, now() + interval '1 hour')", [b.childId]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(RLS_VIOLATION);
  });

  it("parent cannot write device data", async () => {
    const statements: [string, unknown[]][] = [
      ["insert into devices (child_id, token_hash, browser, os) values ($1, 'parent-h', 'chrome', 'Windows')", [a.childId]],
      ["insert into usage_minutes (device_id, minute_utc, domain, seconds) values ($1, '2026-11-17T15:00:00Z', 'example.com', 5)", [a.deviceId]],
      ["insert into block_events (device_id, domain) values ($1, 'example.com')", [a.deviceId]],
      ["insert into alerts (device_id, kind, incident_last_seen_at) values ($1, 'offline', now())", [a.deviceId]],
      ["update devices set last_seen_at = now() where id = $1", [a.deviceId]],
      ["insert into families (name) values ('rogue')", []],
      ["insert into parents (user_id, family_id) values (gen_random_uuid(), $1)", [a.familyId]],
    ];
    for (const [sql, params] of statements) {
      const r = await attempt(db, parentA(), sql, params);
      expect(r.ok ? r.affected : 0, sql).toBe(0);
    }
  });

  describe("active pairing codes are unique across all families", () => {
    const future = "now() + interval '1 hour'";
    const past = "now() - interval '1 hour'";

    it("duplicate of another family's active code is rejected", async () => {
      await db.query(`insert into pairing_codes (code, child_id, expires_at) values ('DUP001', $1, ${future})`, [a.childId]);
      const before = await one(db, "select child_id, expires_at from pairing_codes where code = 'DUP001'");
      const r = await attempt(db, parentB(), `insert into pairing_codes (code, child_id, expires_at) values ('DUP001', $1, ${future})`, [b.childId]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe(UNIQUE_VIOLATION);
      const after = await one(db, "select child_id, expires_at from pairing_codes where code = 'DUP001'");
      expect(after).toEqual(before);
      const seen = await attempt(db, parentB(), "select child_id from pairing_codes where code = 'DUP001'");
      expect(seen.ok && seen.rows).toEqual([]);
    });

    it("duplicate within the same family is rejected", async () => {
      await db.query(`insert into pairing_codes (code, child_id, expires_at) values ('DUP002', $1, ${future})`, [a.childId]);
      const r = await attempt(db, parentA(), `insert into pairing_codes (code, child_id, expires_at) values ('DUP002', $1, ${future})`, [a.childId2]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe(UNIQUE_VIOLATION);
    });

    it("expired code does not block the value", async () => {
      await db.query(`insert into pairing_codes (code, child_id, expires_at) values ('EXP001', $1, ${past})`, [a.childId]);
      const r = await attempt(db, parentB(), `insert into pairing_codes (code, child_id, expires_at) values ('EXP001', $1, ${future})`, [b.childId]);
      expect(r.ok).toBe(true);
      const rows = await db.query<{ child_id: string }>("select child_id from pairing_codes where code = 'EXP001'");
      expect(rows.rows).toEqual([{ child_id: b.childId }]);
    });

    it("other codes are untouched by the cleanup", async () => {
      await db.query(`insert into pairing_codes (code, child_id, expires_at) values ('ZZ99ZZ', $1, ${past})`, [a.childId]);
      await db.query(`insert into pairing_codes (code, child_id, expires_at) values ('AC71VE', $1, ${future})`, [a.childId]);
      const r = await attempt(db, parentB(), `insert into pairing_codes (code, child_id, expires_at) values ('QQ11QQ', $1, ${future})`, [b.childId]);
      expect(r.ok).toBe(true);
      const rows = await db.query<{ code: string }>("select code from pairing_codes where code in ('ZZ99ZZ', 'AC71VE') order by code");
      expect(rows.rows.map((x) => x.code)).toEqual(["AC71VE", "ZZ99ZZ"]);
    });
  });
});

describe("migration documentation", () => {
  it("README covers the essentials", () => {
    const readme = readFileSync(join(__dirname, "..", "README.md"), "utf8");
    expect(readme).toContain("supabase db push");
    expect(readme).toContain("supabase/migrations");
    expect(readme).toContain("npm run check");
    expect(readme).toMatch(/never edit/i);
  });
});
