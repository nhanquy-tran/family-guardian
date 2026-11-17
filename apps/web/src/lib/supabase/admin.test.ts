import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const webSrc = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = join(webSrc, "..", "..", "..");
const SKIP_DIRS = new Set(["node_modules", ".output", ".wxt", ".next", "dist"]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(tsx?|mts|js|mjs)$/.test(name) && !/\.test\.(tsx?|mts)$/.test(name)) out.push(full);
  }
  return out;
}

const read = (file: string) => readFileSync(file, "utf8");

type RpcResult = { data: unknown; error: { message: string } | null };

function fakeClient(rpcResult: RpcResult) {
  const rpc = vi.fn(async () => rpcResult);
  return { client: { rpc } as never, rpc };
}

afterEach(() => vi.unstubAllEnvs());

describe("createPairDeps", () => {
  it("RPC error becomes a thrown error", async () => {
    vi.stubEnv("PAIR_RATE_LIMIT_SECRET", "test-secret");
    const { createPairDeps } = await import("./admin");
    const f = fakeClient({ data: null, error: { message: "boom" } });
    const deps = createPairDeps(f.client);
    await expect(Promise.resolve().then(() => deps.registerAttempt("a".repeat(64)))).rejects.toThrow();
    expect(f.rpc).toHaveBeenCalledWith("register_pair_attempt", expect.anything());
    await expect(
      Promise.resolve().then(() => deps.redeem("AB2CD3", "b".repeat(64), "chrome", "Windows")),
    ).rejects.toThrow();
    expect(f.rpc).toHaveBeenCalledWith("redeem_pairing_code", expect.anything());
  });

  it("HMAC secret missing", async () => {
    const { createPairDeps } = await import("./admin");
    for (const value of [undefined, ""]) {
      if (value === undefined) delete process.env.PAIR_RATE_LIMIT_SECRET;
      else vi.stubEnv("PAIR_RATE_LIMIT_SECRET", value);
      const f = fakeClient({ data: 1, error: null });
      const deps = createPairDeps(f.client);
      expect(() => deps.hashIp("203.0.113.5")).toThrow(/PAIR_RATE_LIMIT_SECRET/);
      expect(f.rpc).not.toHaveBeenCalled();
    }
  });
});

describe("admin.ts is server-only", () => {
  it("admin.ts is server-only", () => {
    const admin = read(join(webSrc, "lib", "supabase", "admin.ts"));
    const first = admin.split("\n").find((line) => line.trim() !== "" && !line.trim().startsWith("//"));
    expect(first).toMatch(/^import ["']server-only["'];?$/);
    const mentions = sourceFiles(webSrc).filter((f) => read(f).includes("SUPABASE_SERVICE_ROLE_KEY"));
    expect(mentions.map((f) => f.slice(webSrc.length + 1))).toEqual([join("lib", "supabase", "admin.ts")]);
  });

  it("Client code does not import the service-role client", () => {
    const files = [
      ...sourceFiles(join(webSrc, "components")),
      ...sourceFiles(webSrc).filter((f) => /^\s*["']use client["']/.test(read(f))),
      ...sourceFiles(join(repoRoot, "packages", "shared", "src")),
      ...sourceFiles(join(repoRoot, "apps", "extension")),
    ];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = read(file);
      expect(text, file).not.toMatch(/supabase\/admin/);
      expect(text, file).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(text, file).not.toContain("PAIR_RATE_LIMIT_SECRET");
    }
  });

  it("Secret name is documented, value is not", () => {
    const env = read(join(webSrc, "..", ".env.example"));
    expect(env.split("\n")).toContain("PAIR_RATE_LIMIT_SECRET=");
  });
});
