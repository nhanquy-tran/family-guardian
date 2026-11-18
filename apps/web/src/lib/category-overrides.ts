import type { Category } from "@fg/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CategoryOverride = { id: string; domain: string; category: Category };
export type CategoryOverrideError = "invalid_domain" | "invalid_category" | "not_found" | "failed";
export type CategoryOverrideResult = { ok: true } | { ok: false; error: CategoryOverrideError };
export type ListOverridesResult = { ok: true; overrides: CategoryOverride[] } | { ok: false; error: "failed" };

export async function listCategoryOverrides(_client: SupabaseClient): Promise<ListOverridesResult> {
  throw new Error("not implemented");
}

export async function saveCategoryOverride(
  _client: SupabaseClient,
  _domainInput: string,
  _category: string,
): Promise<CategoryOverrideResult> {
  throw new Error("not implemented");
}

export async function removeCategoryOverride(_client: SupabaseClient, _id: string): Promise<CategoryOverrideResult> {
  throw new Error("not implemented");
}
