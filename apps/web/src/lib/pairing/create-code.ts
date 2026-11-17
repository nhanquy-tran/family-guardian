import type { SupabaseClient } from "@supabase/supabase-js";
import { PAIRING_CODE_TTL_MS } from "@fg/shared";

export type PairingErrorReason = "in-use" | "custom-in-use" | "failed";
export type CreateCodeResult =
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; reason: PairingErrorReason };
export type CreateCodeOptions = { now: Date; generate: () => string; customCode?: string };

export const PAIRING_ERROR_MESSAGES: Record<PairingErrorReason, string> = {
  "in-use": "This code is already in use. Generate another code.",
  "custom-in-use": "This code is already in use, please choose another",
  failed: "Could not create a code. Please try again.",
};

const MAX_RETRIES = 3;
const UNIQUE_VIOLATION = "23505";

export async function createPairingCode(
  client: SupabaseClient,
  childId: string,
  options: CreateCodeOptions,
): Promise<CreateCodeResult> {
  const expiresAt = new Date(options.now.getTime() + PAIRING_CODE_TTL_MS).toISOString();

  const cleared = await client.from("pairing_codes").delete().eq("child_id", childId);
  if (cleared.error) return { ok: false, reason: "failed" };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const code = options.customCode ?? options.generate();
    const { error } = await client.from("pairing_codes").insert({ code, child_id: childId, expires_at: expiresAt });
    if (!error) return { ok: true, code, expiresAt };
    if (error.code !== UNIQUE_VIOLATION) return { ok: false, reason: "failed" };
    if (options.customCode) return { ok: false, reason: "custom-in-use" };
  }
  return { ok: false, reason: "in-use" };
}
