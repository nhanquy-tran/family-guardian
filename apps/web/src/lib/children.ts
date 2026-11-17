import type { SupabaseClient } from "@supabase/supabase-js";

export type ChildRow = { id: string; name: string; created_at: string };
export type ChildResult = { ok: true } | { ok: false; error: string };

export async function listChildren(client: SupabaseClient): Promise<ChildRow[]> {
  void client;
  throw new Error("not implemented");
}

export async function addChild(client: SupabaseClient, name: string): Promise<ChildResult> {
  void client;
  void name;
  throw new Error("not implemented");
}

export async function renameChild(client: SupabaseClient, id: string, name: string): Promise<ChildResult> {
  void client;
  void id;
  void name;
  throw new Error("not implemented");
}

export async function deleteChild(client: SupabaseClient, id: string): Promise<ChildResult> {
  void client;
  void id;
  throw new Error("not implemented");
}
