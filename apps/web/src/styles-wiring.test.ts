import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string): string => readFileSync(join(webRoot, p), "utf8");

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? cssFiles(join(dir, e.name)) : e.name.endsWith(".css") ? [join(dir, e.name)] : [],
  );
}

describe("Tailwind generates CSS", () => {
  it("Tailwind is wired", () => {
    const pkg = JSON.parse(read("package.json")) as { devDependencies?: Record<string, string> };
    const dev = pkg.devDependencies ?? {};
    const turbopack = read("next.config.ts").includes("@tailwindcss/turbopack");
    const postcss =
      existsSync(join(webRoot, "postcss.config.mjs")) &&
      read("postcss.config.mjs").includes("@tailwindcss/postcss") &&
      "@tailwindcss/postcss" in dev;
    expect([turbopack, postcss].filter(Boolean)).toHaveLength(1);
    expect(read("src/app/globals.css")).toMatch(/@import\s+["']tailwindcss["']/);
  });

  const staticDir = join(webRoot, ".next", "static");
  it.skipIf(!existsSync(staticDir))("build emits the classes", () => {
    const css = cssFiles(staticDir)
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    expect(css).toMatch(/\.rounded-lg\b/);
    expect(css).toMatch(/\.max-w-sm\b/);
  });
});
