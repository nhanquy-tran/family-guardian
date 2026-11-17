import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hmacSha256Hex, type PairDeps } from "../pairing/pair-device";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export function createAdminClient() {
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

export function createPairDeps(client: SupabaseClient): PairDeps {
  return {
    hashIp: (ip) => hmacSha256Hex(required("PAIR_RATE_LIMIT_SECRET"), ip),
    registerAttempt: async (ipHash) => {
      const { data, error } = await client.rpc("register_pair_attempt", { p_ip_hash: ipHash });
      if (error) throw new Error("register_pair_attempt failed");
      return Number(data);
    },
    redeem: async (code, tokenHash, browser, os) => {
      const { data, error } = await client.rpc("redeem_pairing_code", {
        p_code: code,
        p_token_hash: tokenHash,
        p_browser: browser,
        p_os: os,
      });
      if (error) throw new Error("redeem_pairing_code failed");
      return (data as string | null) ?? null;
    },
  };
}
