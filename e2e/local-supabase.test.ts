import { describe, expect, it } from "vitest";
import { assertLocal } from "./local-supabase.ts";
import { supabaseStore } from "./fixtures/supabase-store.ts";

describe("e2e data only targets the local stack", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321"])("accepts %s", (url) => {
    expect(() => assertLocal(url)).not.toThrow();
  });

  it.each(["https://abcd.supabase.co", "https://family-guardian.co", "http://127.0.0.1.nip.io:54321"])("refuses %s", (url) => {
    expect(() => assertLocal(url)).toThrow(/local Supabase/);
  });

  it("the Supabase store refuses a hosted project before any request", () => {
    expect(() => supabaseStore({ url: "https://abcd.supabase.co", anonKey: "a", serviceRoleKey: "s" })).toThrow(/local Supabase/);
  });
});
