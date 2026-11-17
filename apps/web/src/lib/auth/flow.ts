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

export async function startGoogleSignIn(_client: AuthClient, _origin: string): Promise<string> {
  throw new Error("not implemented");
}

export async function completeSignIn(_client: AuthClient, _code: string | null): Promise<string> {
  throw new Error("not implemented");
}

export async function signOut(_client: AuthClient): Promise<string> {
  throw new Error("not implemented");
}
