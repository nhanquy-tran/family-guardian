import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertLocal, type LocalSupabase } from "../local-supabase.ts";

/** PAIR_RATE_LIMIT_SECRET for the e2e web server. Local stack only; it is not a production value. */
export const E2E_PAIR_SECRET = "e2e-local-pair-rate-limit";

/** The client IP e2e pair requests claim (TEST-NET-3), as Vercel would forward it. */
export const E2E_PAIR_IP = "203.0.113.55";

/**
 * Pair attempts are keyed by an IP hash, not a family, so the family teardown does not reach them.
 * Removes the rows e2e pairing wrote, so a run leaves no rate-limit state behind.
 */
export async function removePairAttempts(env: LocalSupabase): Promise<void> {
  assertLocal(env.url);
  const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ipHash = createHmac("sha256", E2E_PAIR_SECRET).update(E2E_PAIR_IP).digest("hex");
  const { error } = await db.from("pair_attempts").delete().eq("ip_hash", ipHash);
  if (error) throw new Error(`delete pair attempts: ${error.message}`);
}
