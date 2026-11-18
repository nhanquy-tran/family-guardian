import type { Category } from "@fg/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DailyLimit = { category: Category; minutesPerDay: number };
export type DailyLimitError = "invalid_category" | "invalid_minutes" | "failed";
export type SaveLimitsResult = { ok: true } | { ok: false; error: DailyLimitError };
export type ListLimitsResult = { ok: true; limits: DailyLimit[] } | { ok: false; error: "failed" };

export async function listDailyLimits(_client: SupabaseClient, _childId: string): Promise<ListLimitsResult> {
  throw new Error("not implemented");
}

export async function saveDailyLimits(
  _client: SupabaseClient,
  _childId: string,
  _values: Record<string, string>,
): Promise<SaveLimitsResult> {
  throw new Error("not implemented");
}
