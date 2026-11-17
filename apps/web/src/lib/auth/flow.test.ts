import { describe, expect, it, vi } from "vitest";
import { completeSignIn, signOut, startGoogleSignIn, type AuthClient } from "./flow";

type OAuthResult = { data: { url: string | null }; error: unknown };

function fakeClient(over: {
  oauth?: OAuthResult;
  exchange?: { error: unknown };
  signOut?: { error: unknown };
}) {
  const signInWithOAuth = vi.fn(async () => over.oauth ?? { data: { url: null }, error: null });
  const exchangeCodeForSession = vi.fn(async () => over.exchange ?? { error: null });
  const signOutFn = vi.fn(async () => over.signOut ?? { error: null });
  const client: AuthClient = {
    auth: { signInWithOAuth, exchangeCodeForSession, signOut: signOutFn },
  };
  return { client, signInWithOAuth, exchangeCodeForSession, signOut: signOutFn };
}

describe("startGoogleSignIn", () => {
  it("provider URL returned", async () => {
    const f = fakeClient({ oauth: { data: { url: "https://accounts.example/o" }, error: null } });
    const result = await startGoogleSignIn(f.client, "https://fg.test");
    expect(f.signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(f.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://fg.test/auth/callback" },
    });
    expect(result).toBe("https://accounts.example/o");
  });

  it("OAuth start fails", async () => {
    const withError = fakeClient({ oauth: { data: { url: null }, error: new Error("boom") } });
    expect(await startGoogleSignIn(withError.client, "https://fg.test")).toBe("/login?error=auth");
    const noUrl = fakeClient({ oauth: { data: { url: null }, error: null } });
    expect(await startGoogleSignIn(noUrl.client, "https://fg.test")).toBe("/login?error=auth");
  });
});

describe("completeSignIn", () => {
  it("valid code", async () => {
    const f = fakeClient({ exchange: { error: null } });
    const result = await completeSignIn(f.client, "abc");
    expect(f.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(result).toBe("/dashboard");
  });

  it("missing code", async () => {
    const f = fakeClient({});
    const result = await completeSignIn(f.client, null);
    expect(result).toBe("/login?error=auth");
    expect(f.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("exchange error", async () => {
    const f = fakeClient({ exchange: { error: new Error("bad code") } });
    expect(await completeSignIn(f.client, "bad")).toBe("/login?error=auth");
  });
});

describe("signOut", () => {
  it("sign out returns to login", async () => {
    const ok = fakeClient({ signOut: { error: null } });
    expect(await signOut(ok.client)).toBe("/login");
    expect(ok.signOut).toHaveBeenCalledTimes(1);

    const failing = fakeClient({ signOut: { error: new Error("nope") } });
    expect(await signOut(failing.client)).toBe("/login");
    expect(failing.signOut).toHaveBeenCalledTimes(1);
  });
});
