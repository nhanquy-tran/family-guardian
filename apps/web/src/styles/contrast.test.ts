import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "tokens.css"), "utf8");

function declarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1] ?? ""] = (m[2] ?? "").toLowerCase();
  return out;
}

const lightBlock = css.match(/^:root\s*\{([\s\S]*?)\n\}/m)?.[1] ?? "";
const darkBlock = css.match(/prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\([^)]*\)\s*\{([\s\S]*?)\n\s*\}\s*\n\}/)?.[1] ?? "";
const light = declarations(lightBlock);
const dark = { ...light, ...declarations(darkBlock) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: [string, string][] = [
  ["--ink", "--card"],
  ["--ink", "--ground"],
  ["--ink", "--shell"],
  ["--ink-2", "--card"],
  ["--ink-2", "--ground"],
  ["--ink-2", "--shell"],
  ["--accent-contrast", "--accent"],
  ["--accent-ink", "--accent-soft"],
  ["--ink", "--green-soft"],
  ["--ink", "--amber-soft"],
  ["--ink", "--red-soft"],
];

describe("readable colours in light and dark", () => {
  it("contrast of text pairs", () => {
    expect(Object.keys(light).length).toBeGreaterThan(10);
    expect(darkBlock).not.toBe("");
    for (const [mode, tokens] of [
      ["light", light],
      ["dark", dark],
    ] as const) {
      for (const [fg, bg] of PAIRS) {
        const f = tokens[fg];
        const b = tokens[bg];
        expect(f, `${mode} ${fg}`).toBeDefined();
        expect(b, `${mode} ${bg}`).toBeDefined();
        expect(contrast(f ?? "", b ?? ""), `${mode} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
