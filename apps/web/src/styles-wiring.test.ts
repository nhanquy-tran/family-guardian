import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string): string => readFileSync(join(webRoot, p), "utf8");
const readDesign = (p: string): string => readFileSync(join(webRoot, "..", "..", "docs", "design", p), "utf8");

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
    const css = read("src/app/globals.css");
    expect(css).toMatch(/@import\s+["'][^"']*tokens\.css["']/);
    const theme = css.match(/@theme inline\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
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
    const body = css.match(/body\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(body).toMatch(/background\s*:\s*var\(--ground\)/);
    expect(body).toMatch(/font-family\s*:\s*var\(--font\)/);
  });

  it("token copy equals the design source", () => {
    expect(read("src/styles/tokens.css")).toBe(readDesign("tokens.css"));
  });

  it("Inter replaces Geist", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/import\s*\{[^}]*\bInter\b[^}]*\}\s*from\s*["']next\/font\/google["']/);
    expect(layout).not.toMatch(/\bGeist(_Mono)?\b/);
  });

  it("icon files match the design source", () => {
    const source = readDesign("icon.svg");
    expect(read("src/app/icon.svg")).toBe(source);
    expect(read("public/icon.svg")).toBe(source);
    expect(existsSync(join(webRoot, "src", "app", "favicon.ico"))).toBe(false);
  });
});
