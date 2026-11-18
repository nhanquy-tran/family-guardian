import type { SupabaseClient } from "@supabase/supabase-js";

export type DigestSettingsResult = { ok: true } | { ok: false; error: "invalid" | "failed" };

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// RLS limits the update to the caller's family.
export async function saveDigestSettings(
  client: SupabaseClient,
  input: { frequency: unknown; hour: unknown; timezone: unknown },
): Promise<DigestSettingsResult> {
  const { frequency, hour, timezone } = input;
  if (
    (frequency !== "daily" && frequency !== "weekly") ||
    typeof hour !== "number" ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !isValidTimezone(timezone)
  ) {
    return { ok: false, error: "invalid" };
  }
  const { data, error } = await client
    .from("families")
    .update({ digest_frequency: frequency, digest_hour: hour, timezone, timezone_known: true })
    .select("id");
  if (error || !data || data.length === 0) return { ok: false, error: "failed" };
  return { ok: true };
}

export async function captureFamilyTimezone(client: SupabaseClient, timezone: string): Promise<void> {
  if (!isValidTimezone(timezone)) return;
  await client.from("families").update({ timezone, timezone_known: true }).eq("timezone_known", false);
}

export type WeeklyReportSaveResult = { ok: true } | { ok: false; error: "invalid" | "failed" };
export type WeeklyReportLoadResult = { ok: true; enabled: boolean } | { ok: false };

export async function saveWeeklyReportSetting(client: SupabaseClient, enabled: unknown): Promise<WeeklyReportSaveResult> {
  if (typeof enabled !== "boolean") return { ok: false, error: "invalid" };
  const { data, error } = await client.from("families").update({ weekly_report_enabled: enabled }).select("id");
  if (error || !data || data.length === 0) return { ok: false, error: "failed" };
  return { ok: true };
}

export async function loadWeeklyReportSetting(client: SupabaseClient): Promise<WeeklyReportLoadResult> {
  const { data, error } = await client.from("families").select("weekly_report_enabled").maybeSingle();
  if (error || !data) return { ok: false };
  return { ok: true, enabled: (data as { weekly_report_enabled: boolean }).weekly_report_enabled === true };
}
