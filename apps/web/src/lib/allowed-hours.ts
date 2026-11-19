import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAllowedHours } from "@fg/shared";

export type AllowedHoursError = "invalid_hours" | "failed";
export type SaveAllowedHoursResult = { ok: true } | { ok: false; error: AllowedHoursError };

export async function saveAllowedHours(
  client: SupabaseClient,
  childId: string,
  values: { start: string; end: string },
): Promise<SaveAllowedHoursResult> {
  const start = values.start.trim();
  const end = values.end.trim();
  const clear = start === "" && end === "";
  if (!clear && parseAllowedHours(start, end) === null) return { ok: false, error: "invalid_hours" };
  try {
    const { error } = await client
      .from("children")
      .update({ allowed_start: clear ? null : start, allowed_end: clear ? null : end })
      .eq("id", childId);
    if (error) return { ok: false, error: "failed" };
    return { ok: true };
  } catch {
    return { ok: false, error: "failed" };
  }
}
