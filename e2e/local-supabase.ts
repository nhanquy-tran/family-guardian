import { execSync } from "node:child_process";
import { join } from "node:path";

export type LocalSupabase = { url: string; anonKey: string; serviceRoleKey: string };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Seeding and teardown delete accounts and families, so they only ever run against the local Docker stack. */
export function assertLocal(url: string): void {
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) throw new Error(`e2e data only targets the local Supabase stack, not ${host}`);
}

/** Reads the running local stack's URL and keys from `supabase status`; start it with `npx supabase start`. */
export function localSupabase(): LocalSupabase {
  let raw: string;
  try {
    raw = execSync("npx supabase status -o json", {
      cwd: join(import.meta.dirname, ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("Local Supabase is not running. Start Docker Desktop, then run `npx supabase start` at the repo root.");
  }
  const status = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  const env: LocalSupabase = {
    url: status.API_URL ?? "",
    anonKey: status.ANON_KEY ?? status.PUBLISHABLE_KEY ?? "",
    serviceRoleKey: status.SERVICE_ROLE_KEY ?? status.SECRET_KEY ?? "",
  };
  assertLocal(env.url);
  return env;
}
