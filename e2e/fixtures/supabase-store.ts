import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertLocal, type LocalSupabase } from "../local-supabase.ts";
import type { Store } from "./store.ts";

function check(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export function supabaseStore(env: LocalSupabase): Store {
  assertLocal(env.url);
  const db: SupabaseClient = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async createParent(email, fullName) {
      const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } });
      check(error, "create parent");
      const userId = data.user?.id ?? "";
      const parent = await db.from("parents").select("family_id").eq("user_id", userId).single();
      check(parent.error, "read family");
      return { userId, familyId: (parent.data as { family_id: string }).family_id };
    },
    async findUsers(domain) {
      const ids: string[] = [];
      for (let page = 1; ; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        check(error, "list users");
        ids.push(...data.users.filter((u) => u.email?.endsWith(`@${domain}`)).map((u) => u.id));
        if (data.users.length < 1000) return ids;
      }
    },
    async familiesOf(userIds) {
      const { data, error } = await db.from("parents").select("family_id").in("user_id", userIds);
      check(error, "read families");
      return (data as { family_id: string }[]).map((r) => r.family_id);
    },
    async updateFamily(familyId, patch) {
      check((await db.from("families").update(patch).eq("id", familyId)).error, "update family");
    },
    async insert(table, rows) {
      for (let i = 0; i < rows.length; i += 1000) {
        check((await db.from(table).insert(rows.slice(i, i + 1000))).error, `insert ${table}`);
      }
    },
    async deleteFamilies(ids) {
      check((await db.from("families").delete().in("id", ids)).error, "delete families");
    },
    async deleteUsers(ids) {
      for (const id of ids) check((await db.auth.admin.deleteUser(id)).error, "delete user");
    },
  };
}
