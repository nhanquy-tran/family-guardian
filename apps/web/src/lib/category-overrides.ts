import { CATEGORIES, type Category } from "@fg/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBlockDomain } from "./block-rules";

export type CategoryOverride = { id: string; domain: string; category: Category };
export type CategoryOverrideError = "invalid_domain" | "invalid_category" | "not_found" | "failed";
export type CategoryOverrideResult = { ok: true } | { ok: false; error: CategoryOverrideError };
export type ListOverridesResult = { ok: true; overrides: CategoryOverride[] } | { ok: false; error: "failed" };

export async function listCategoryOverrides(client: SupabaseClient): Promise<ListOverridesResult> {
  const { data, error } = await client
    .from("domain_categories")
    .select("id, domain, category")
    .not("family_id", "is", null);
  if (error || !data) return { ok: false, error: "failed" };
  const overrides = (data as CategoryOverride[])
    .map(({ id, domain, category }) => ({ id, domain, category }))
    .sort((a, b) => (a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0));
  return { ok: true, overrides };
}

export async function saveCategoryOverride(
  client: SupabaseClient,
  domainInput: string,
  category: string,
): Promise<CategoryOverrideResult> {
  const domain = normalizeBlockDomain(domainInput);
  if (!domain) return { ok: false, error: "invalid_domain" };
  if (!(CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: "invalid_category" };

  const { data: parent, error: parentError } = await client.from("parents").select("family_id").maybeSingle();
  const familyId = (parent as { family_id?: string } | null)?.family_id;
  if (parentError || !familyId) return { ok: false, error: "failed" };

  const { error } = await client
    .from("domain_categories")
    .upsert({ family_id: familyId, domain, category }, { onConflict: "family_id,domain" });
  return error ? { ok: false, error: "failed" } : { ok: true };
}

export async function removeCategoryOverride(client: SupabaseClient, id: string): Promise<CategoryOverrideResult> {
  const { data, error } = await client.from("domain_categories").delete().eq("id", id).select("id");
  if (error || !data) return { ok: false, error: "failed" };
  return data.length > 0 ? { ok: true } : { ok: false, error: "not_found" };
}
