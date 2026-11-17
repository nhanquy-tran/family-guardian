export interface AuthClient {
  auth: {
    signInWithOAuth(args: {
      provider: "google";
      options: { redirectTo: string };
    }): Promise<{ data: { url: string | null }; error: unknown }>;
    exchangeCodeForSession(code: string): Promise<{ error: unknown }>;
    signOut(): Promise<{ error: unknown }>;
  };
}

const AUTH_ERROR = "/login?error=auth";

export async function startGoogleSignIn(client: AuthClient, origin: string): Promise<string> {
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  return error || !data.url ? AUTH_ERROR : data.url;
}

export async function completeSignIn(client: AuthClient, code: string | null): Promise<string> {
  if (!code) return AUTH_ERROR;
  const { error } = await client.auth.exchangeCodeForSession(code);
  return error ? AUTH_ERROR : "/dashboard";
}

export async function signOut(client: AuthClient): Promise<string> {
  await client.auth.signOut();
  return "/login";
}
