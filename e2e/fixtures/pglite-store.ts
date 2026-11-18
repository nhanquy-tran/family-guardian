import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import type { Row, Store } from "./store.ts";

const IDENT = /^[a-z_]+$/;

function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`unexpected identifier ${name}`);
  return name;
}

/** Store over the PGlite test harness; bypasses RLS like the service role does. */
export function pgliteStore(db: PGlite): Store {
  return {
    async createParent(email, fullName) {
      const userId = randomUUID();
      await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)", [
        userId,
        email,
        JSON.stringify({ full_name: fullName }),
      ]);
      const res = await db.query<{ family_id: string }>("select family_id from public.parents where user_id = $1", [userId]);
      return { userId, familyId: res.rows[0]?.family_id ?? "" };
    },
    async findUsers(domain) {
      const res = await db.query<{ id: string }>("select id from auth.users where email like $1", [`%@${domain}`]);
      return res.rows.map((r) => r.id);
    },
    async familiesOf(userIds) {
      const res = await db.query<{ family_id: string }>("select family_id from public.parents where user_id = any($1::uuid[])", [userIds]);
      return res.rows.map((r) => r.family_id);
    },
    async updateFamily(familyId, patch) {
      const keys = Object.keys(patch).map(ident);
      const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
      await db.query(`update public.families set ${sets} where id = $1`, [familyId, ...keys.map((k) => patch[k])]);
    },
    async insert(table, rows) {
      if (rows.length === 0) return;
      const keys = Object.keys(rows[0]).map(ident);
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const params: unknown[] = [];
        const values = chunk.map((row) => `(${keys.map((k) => `$${params.push(row[k])}`).join(", ")})`).join(", ");
        await db.query(`insert into public.${ident(table)} (${keys.join(", ")}) values ${values}`, params);
      }
    },
    async deleteFamilies(ids) {
      await db.query("delete from public.families where id = any($1::uuid[])", [ids]);
    },
    async deleteUsers(ids) {
      await db.query("delete from auth.users where id = any($1::uuid[])", [ids]);
    },
  };
}

