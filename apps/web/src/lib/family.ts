import type { SupabaseClient } from "@supabase/supabase-js";

export async function getFamilyName(client: SupabaseClient): Promise<string> {
  void client;
  throw new Error("not implemented");
}
