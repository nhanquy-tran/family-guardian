import { PGlite } from "@electric-sql/pglite";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

const STAND_IN = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).sort();
}

/** Replays the stand-in and every migration on a fresh database. */
export async function createDbFromMigrations(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(STAND_IN);
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

const SNAPSHOT_DIR = join(__dirname, "..", "..", "node_modules", ".cache", "fg-pglite");

function snapshotKey(): string {
  const hash = createHash("sha256");
  const pkg = join(__dirname, "..", "..", "node_modules", "@electric-sql", "pglite", "package.json");
  hash.update(existsSync(pkg) ? readFileSync(pkg) : "");
  hash.update(STAND_IN);
  for (const file of migrationFiles()) hash.update(file).update(readFileSync(join(MIGRATIONS_DIR, file)));
  return hash.digest("hex").slice(0, 16);
}

/**
 * Replaying every migration costs about 1.8 s per database and grows with each migration, so the
 * migrated database is dumped once per migration set and later databases load that dump (~0.3 s).
 * The key covers the migrations, the stand-in and the PGlite version; a bad migration still fails
 * while the snapshot is built.
 */
export async function ensureSnapshot(): Promise<string> {
  const path = join(SNAPSHOT_DIR, `${snapshotKey()}.tar`);
  if (existsSync(path)) return path;
  const db = await createDbFromMigrations();
  const dump = await db.dumpDataDir("none");
  await db.close();
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const tmp = `${path}.${process.pid}.${randomUUID()}`;
  writeFileSync(tmp, Buffer.from(await dump.arrayBuffer()));
  try {
    renameSync(tmp, path);
  } catch {
    // Another worker published the same snapshot first.
    rmSync(tmp, { force: true });
  }
  for (const old of readdirSync(SNAPSHOT_DIR)) {
    if (old.endsWith(".tar") && join(SNAPSHOT_DIR, old) !== path) rmSync(join(SNAPSHOT_DIR, old), { force: true });
  }
  return path;
}

let snapshot: Promise<Blob> | null = null;

export async function createDb(): Promise<PGlite> {
  snapshot ??= ensureSnapshot().then((path) => new Blob([readFileSync(path)]));
  const db = new PGlite({ loadDataDir: await snapshot });
  await db.waitReady;
  return db;
}

export type Db = PGlite;

async function asRole<T>(db: Db, role: string, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}`);
    if (userId) await db.exec(`set local request.jwt.claim.sub = '${userId}'`);
    const result = await fn();
    await db.exec("commit");
    return result;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

export const asParent = <T>(db: Db, userId: string, fn: () => Promise<T>) =>
  asRole(db, "authenticated", userId, fn);
export const asAnon = <T>(db: Db, fn: () => Promise<T>) => asRole(db, "anon", null, fn);
export const asService = <T>(db: Db, fn: () => Promise<T>) => asRole(db, "service_role", null, fn);

/**
 * Runs one statement as the given role and reports the outcome without leaving
 * a failed transaction behind. Returns the SQLSTATE code on error.
 */
export async function attempt(
  db: Db,
  as: { parent: string } | "anon" | "service",
  sql: string,
  params: unknown[] = [],
): Promise<{ ok: true; rows: Record<string, unknown>[]; affected: number } | { ok: false; code: string; message: string }> {
  const run = async () => {
    const res = await db.query<Record<string, unknown>>(sql, params);
    return { ok: true as const, rows: res.rows, affected: res.affectedRows ?? res.rows.length };
  };
  try {
    if (as === "anon") return await asAnon(db, run);
    if (as === "service") return await asService(db, run);
    return await asParent(db, as.parent, run);
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return { ok: false, code: e.code ?? "", message: e.message ?? String(error) };
  }
}

export async function createUser(
  db: Db,
  name?: string,
): Promise<{ userId: string; familyId: string }> {
  const userId = randomUUID();
  const meta = name ? { full_name: name } : {};
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)", [
    userId,
    `${userId}@example.com`,
    JSON.stringify(meta),
  ]);
  const res = await db.query<{ family_id: string }>("select family_id from public.parents where user_id = $1", [
    userId,
  ]);
  return { userId, familyId: res.rows[0]?.family_id ?? "" };
}
