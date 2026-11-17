import type { SupabaseClient } from "@supabase/supabase-js";

const FAILED = "/login?error=auth";

export async function startGoogleSignIn(client: SupabaseClient, origin: string): Promise<string> {
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data?.url) return FAILED;
  return data.url;
}

export async function completeSignIn(client: SupabaseClient, code: string | null): Promise<string> {
  if (!code) return FAILED;
  const { error } = await client.auth.exchangeCodeForSession(code);
  return error ? FAILED : "/dashboard";
}

export async function signOut(client: SupabaseClient): Promise<string> {
  await client.auth.signOut();
  return "/login";
}
