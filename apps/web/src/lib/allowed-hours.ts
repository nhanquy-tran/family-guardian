import type { SupabaseClient } from "@supabase/supabase-js";

export type AllowedHoursError = "invalid_hours" | "failed";
export type SaveAllowedHoursResult = { ok: true } | { ok: false; error: AllowedHoursError };

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export async function saveAllowedHours(
  client: SupabaseClient,
  childId: string,
  values: { start: string; end: string },
): Promise<SaveAllowedHoursResult> {
  const start = values.start.trim();
  const end = values.end.trim();
  const clear = start === "" && end === "";
  if (!clear && !(TIME.test(start) && TIME.test(end) && start !== end)) return { ok: false, error: "invalid_hours" };
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
