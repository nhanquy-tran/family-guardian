import type { SupabaseClient } from "@supabase/supabase-js";

export type ChildRow = { id: string; name: string; created_at: string };
export type ChildResult = { ok: true } | { ok: false; error: string };

const NAME_ERROR = "Name must be 1 to 50 characters";
const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_FOUND = "Child not found";

function validName(name: string): string | null {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 50 ? trimmed : null;
}

/** RLS turns a write to another family's child into zero rows, not an error. */
function changed(rows: unknown[] | null, error: unknown): ChildResult {
  if (error || !rows) return { ok: false, error: GENERIC_ERROR };
  return rows.length > 0 ? { ok: true } : { ok: false, error: NOT_FOUND };
}

export async function listChildren(client: SupabaseClient): Promise<ChildRow[]> {
  const { data, error } = await client.from("children").select("id, name, created_at").order("created_at");
  if (error || !data) return [];
  return data as ChildRow[];
}

export async function addChild(client: SupabaseClient, name: string): Promise<ChildResult> {
  const valid = validName(name);
  if (!valid) return { ok: false, error: NAME_ERROR };
  const { data: parent, error: parentError } = await client.from("parents").select("family_id").maybeSingle();
  if (parentError) return { ok: false, error: GENERIC_ERROR };
  if (!parent) return { ok: false, error: "No family for this account" };
  const { error } = await client.from("children").insert({ family_id: parent.family_id, name: valid });
  return error ? { ok: false, error: GENERIC_ERROR } : { ok: true };
}

export async function renameChild(client: SupabaseClient, id: string, name: string): Promise<ChildResult> {
  const valid = validName(name);
  if (!valid) return { ok: false, error: NAME_ERROR };
  const { data, error } = await client.from("children").update({ name: valid }).eq("id", id).select("id");
  return changed(data, error);
}

export async function deleteChild(client: SupabaseClient, id: string): Promise<ChildResult> {
  const { data, error } = await client.from("children").delete().eq("id", id).select("id");
  return changed(data, error);
}
