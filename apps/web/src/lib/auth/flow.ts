import type { SupabaseClient } from "@supabase/supabase-js";

export async function startGoogleSignIn(client: SupabaseClient, origin: string): Promise<string> {
  void client;
  void origin;
  throw new Error("not implemented");
}

export async function completeSignIn(client: SupabaseClient, code: string | null): Promise<string> {
  void client;
  void code;
  throw new Error("not implemented");
}

export async function signOut(client: SupabaseClient): Promise<string> {
  void client;
  throw new Error("not implemented");
}
