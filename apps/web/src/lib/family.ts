import type { SupabaseClient } from "@supabase/supabase-js";

const FALLBACK = "My family";

type FamilyRef = { name: string | null };

export async function getFamilyName(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.from("parents").select("families(name)").maybeSingle();
  if (error || !data) return FALLBACK;
  const families = (data as { families: FamilyRef | FamilyRef[] | null }).families;
  const family = Array.isArray(families) ? families[0] : families;
  return family?.name || FALLBACK;
}
