import type { SupabaseClient } from "@supabase/supabase-js";

export type AllowedHoursError = "invalid_hours" | "failed";
export type SaveAllowedHoursResult = { ok: true } | { ok: false; error: AllowedHoursError };

export async function saveAllowedHours(
  _client: SupabaseClient,
  _childId: string,
  _values: { start: string; end: string },
): Promise<SaveAllowedHoursResult> {
  throw new Error("not implemented");
}
