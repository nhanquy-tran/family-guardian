import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const designDir = join(webRoot, "..", "..", "docs", "design");
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
    expect(css).toMatch(/\.bg-card\b/);
    expect(css).toMatch(/\.rounded-card\b/);
    expect(css).toMatch(/\.rounded-pill\b/);
  });

  it("tokens are loaded and mapped", () => {
    const globals = read("src/app/globals.css");
    expect(existsSync(join(webRoot, "src/styles/tokens.css"))).toBe(true);
    expect(globals).toMatch(/@import\s+["'][^"']*tokens\.css["']/);
    const theme = globals.match(/@theme\s+inline\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    const mapped: Record<string, string> = {
      "--color-ground": "--ground",
      "--color-card": "--card",
      "--color-ink": "--ink",
      "--color-accent": "--accent",
      "--color-red": "--red",
      "--radius-card": "--radius",
      "--shadow-card": "--shadow",
      "--font-sans": "--font",
    };
    for (const [name, token] of Object.entries(mapped)) {
      expect(theme, name).toMatch(new RegExp(`${name}\\s*:\\s*var\\(${token}\\)`));
    }
    const body = globals.match(/body\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(body).toMatch(/background\s*:\s*var\(--ground\)/);
    expect(body).toMatch(/font-family\s*:\s*var\(--font\)/);
  });

  it("token copy equals the design source", () => {
    expect(existsSync(join(webRoot, "src/styles/tokens.css"))).toBe(true);
    expect(read("src/styles/tokens.css")).toBe(readFileSync(join(designDir, "tokens.css"), "utf8"));
  });

  it("Inter replaces Geist", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/import\s*\{[^}]*\bInter\b[^}]*\}\s*from\s*["']next\/font\/google["']/);
    expect(layout).not.toMatch(/Geist/);
  });

  it("icon files match the design source", () => {
    const source = readFileSync(join(designDir, "icon.svg"), "utf8");
    for (const p of ["src/app/icon.svg", "public/icon.svg"]) {
      expect(existsSync(join(webRoot, p)), p).toBe(true);
      expect(read(p), p).toBe(source);
    }
    expect(existsSync(join(webRoot, "src/app/favicon.ico"))).toBe(false);
  });
});
