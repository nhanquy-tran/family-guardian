import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const file = join(dirname(fileURLToPath(import.meta.url)), "tokens.css");
const css = existsSync(file) ? readFileSync(file, "utf8") : "";

function vars(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1] ?? "", m[2] ?? ""]),
  );
}
const light = vars(css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "");
const darkBlock = css.match(/prefers-color-scheme:\s*dark\)\s*\{[\s\S]*?:root:not\([^)]*\)\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";
const dark = { ...light, ...vars(darkBlock) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: [string, string][] = [
  ...["--card", "--ground", "--shell"].flatMap((bg): [string, string][] => [
    ["--ink", bg],
    ["--ink-2", bg],
  ]),
  ["--accent-contrast", "--accent"],
  ["--accent-ink", "--accent-soft"],
  ["--ink", "--green-soft"],
  ["--ink", "--amber-soft"],
  ["--ink", "--red-soft"],
];

describe("readable colours in light and dark", () => {
  it("contrast of text pairs", () => {
    expect(Object.keys(light).length).toBeGreaterThan(10);
    expect(dark["--ground"]).not.toBe(light["--ground"]);
    for (const [mode, t] of [["light", light], ["dark", dark]] as const) {
      for (const [fg, bg] of PAIRS) {
        const f = t[fg];
        const b = t[bg];
        expect(Boolean(f && b), `${mode} ${fg}/${bg} defined`).toBe(true);
        expect(ratio(f ?? "", b ?? ""), `${mode} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
