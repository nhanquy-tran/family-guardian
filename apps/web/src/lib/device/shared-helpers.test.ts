import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe("shared helpers", () => {
  it("Single hash helper", () => {
    const hits = sourceFiles(srcRoot).filter((f) => readFileSync(f, "utf8").includes('createHash("sha256")'));
    expect(hits.map((f) => f.slice(srcRoot.length + 1))).toEqual([join("lib", "device", "token.ts")]);

    const admin = readFileSync(join(srcRoot, "lib", "supabase", "admin.ts"), "utf8");
    const firstImport = admin.split("\n").find((line) => /^\s*import\b/.test(line));
    expect(firstImport).toMatch(/^import ["']server-only["'];?$/);
  });
});
