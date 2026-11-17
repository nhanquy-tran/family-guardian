import { describe, expect, it, vi } from "vitest";
import { completeSignIn, signOut, startGoogleSignIn } from "./flow";

type Client = Parameters<typeof signOut>[0];

function fakeClient(auth: Record<string, unknown>): Client {
  return { auth } as unknown as Client;
}

describe("startGoogleSignIn", () => {
  it("provider URL returned", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: { url: "https://accounts.example/o" }, error: null });
    const result = await startGoogleSignIn(fakeClient({ signInWithOAuth }), "https://fg.test");
    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://fg.test/auth/callback" },
    });
    expect(result).toBe("https://accounts.example/o");
  });

  it("OAuth start fails", async () => {
    const withError = vi.fn().mockResolvedValue({ data: { url: null }, error: new Error("boom") });
    expect(await startGoogleSignIn(fakeClient({ signInWithOAuth: withError }), "https://fg.test")).toBe("/login?error=auth");
    const noUrl = vi.fn().mockResolvedValue({ data: { url: null }, error: null });
    expect(await startGoogleSignIn(fakeClient({ signInWithOAuth: noUrl }), "https://fg.test")).toBe("/login?error=auth");
  });
});

describe("completeSignIn", () => {
  it("valid code", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    const result = await completeSignIn(fakeClient({ exchangeCodeForSession }), "abc");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(result).toBe("/dashboard");
  });

  it("missing code", async () => {
    const exchangeCodeForSession = vi.fn();
    const result = await completeSignIn(fakeClient({ exchangeCodeForSession }), null);
    expect(result).toBe("/login?error=auth");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("exchange error", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: new Error("bad code") });
    expect(await completeSignIn(fakeClient({ exchangeCodeForSession }), "bad")).toBe("/login?error=auth");
  });
});

describe("signOut", () => {
  it("sign out returns to login", async () => {
    for (const error of [null, new Error("fail")]) {
      const fn = vi.fn().mockResolvedValue({ error });
      expect(await signOut(fakeClient({ signOut: fn }))).toBe("/login");
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });
});
