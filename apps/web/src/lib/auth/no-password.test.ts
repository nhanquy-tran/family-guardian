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
    else if (/\.tsx?$/.test(name) && !/\.test\.ts$/.test(name)) out.push(full);
  }
  return out;
}

describe("no e-mail or password authentication", () => {
  it("source scan finds no password auth", () => {
    const files = sourceFiles(srcRoot);
    expect(files.length).toBeGreaterThan(0);
    const forbidden = ["signInWithPassword", "signUp(", "signInWithOtp", "resetPasswordForEmail", 'type="password"', 'type="email"'];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const token of forbidden) {
        expect(text.includes(token), `${file} contains ${token}`).toBe(false);
      }
    }
  });
});
