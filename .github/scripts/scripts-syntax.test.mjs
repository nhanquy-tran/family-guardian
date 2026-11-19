import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dirs = [".github/scripts", "tools/factory-dashboard"];
const scripts = dirs.flatMap((dir) => readdirSync(dir).filter((f) => /\.m?js$/.test(f) && !f.includes(".test.")).map((f) => join(dir, f)));

describe("factory scripts parse", () => {
  it.each(scripts)("%s", (file) => {
    expect(() => execFileSync(process.execPath, ["--check", file], { stdio: "pipe" })).not.toThrow();
  });
});
