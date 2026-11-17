import type { SupabaseClient } from "@supabase/supabase-js";

export type HomeworkError = "invalid_category" | "invalid_domain" | "duplicate" | "too_many" | "not_found" | "failed";
export type HomeworkResult = { ok: true } | { ok: false; error: HomeworkError };

export async function saveHomeworkCategories(_client: SupabaseClient, _childId: string, _categories: string[]): Promise<HomeworkResult> {
  throw new Error("not implemented");
}

export async function addHomeworkDomain(_client: SupabaseClient, _childId: string, _input: string): Promise<HomeworkResult> {
  throw new Error("not implemented");
}

export async function removeHomeworkDomain(_client: SupabaseClient, _childId: string, _domain: string): Promise<HomeworkResult> {
  throw new Error("not implemented");
}
