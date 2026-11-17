import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PairDeps } from "../pairing/pair-device";

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
  void client;
  throw new Error("not implemented");
}
