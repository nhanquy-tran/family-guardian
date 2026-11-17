import type { SupabaseClient } from "@supabase/supabase-js";

export type DigestSettingsResult = { ok: true } | { ok: false; error: "invalid" | "failed" };

export async function saveDigestSettings(
  _client: SupabaseClient,
  _input: { frequency: unknown; hour: unknown; timezone: unknown },
): Promise<DigestSettingsResult> {
  throw new Error("not implemented");
}

export async function captureFamilyTimezone(_client: SupabaseClient, _timezone: string): Promise<void> {
  throw new Error("not implemented");
}
