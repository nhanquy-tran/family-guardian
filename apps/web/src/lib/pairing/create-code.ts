import type { SupabaseClient } from "@supabase/supabase-js";

export type PairingErrorReason = "in-use" | "custom-in-use" | "failed";
export type CreateCodeResult =
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; reason: PairingErrorReason };
export type CreateCodeOptions = { now: Date; generate: () => string; customCode?: string };

export const PAIRING_ERROR_MESSAGES: Record<PairingErrorReason, string> = {
  "in-use": "",
  "custom-in-use": "",
  failed: "",
};

export async function createPairingCode(
  client: SupabaseClient,
  childId: string,
  options: CreateCodeOptions,
): Promise<CreateCodeResult> {
  void client;
  void childId;
  void options;
  throw new Error("not implemented");
}
