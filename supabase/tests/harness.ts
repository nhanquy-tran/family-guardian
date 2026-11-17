import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
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

export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(STAND_IN);
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
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
