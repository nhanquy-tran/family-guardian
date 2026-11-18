import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LOCALES = ["en", "vi", "zh"] as const;
const dir = resolve(__dirname, "../../messages");

function flatten(value: unknown, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = value;
  }
  return out;
}

const load = (l: string) => flatten(JSON.parse(readFileSync(resolve(dir, `${l}.json`), "utf8")));

describe("message files", () => {
  it("Same keys in every language", () => {
    const [en, vi, zh] = LOCALES.map(load);
    const keys = Object.keys(en).sort();
    expect(keys.length).toBeGreaterThan(0);
    expect(Object.keys(vi).sort()).toEqual(keys);
    expect(Object.keys(zh).sort()).toEqual(keys);
    for (const m of [en, vi, zh]) {
      for (const [k, v] of Object.entries(m)) {
        expect(typeof v, k).toBe("string");
        expect((v as string).trim().length, k).toBeGreaterThan(0);
      }
    }
    for (const k of ["hero.title", "hero.subtitle", "privacy.title"]) {
      expect(vi[k], `vi ${k}`).not.toBe(en[k]);
      expect(zh[k], `zh ${k}`).not.toBe(en[k]);
      expect(zh[k] as string, `zh ${k}`).toMatch(/[一-鿿]/);
    }
  });

  it("No pricing or trial content", () => {
    const words = ["price", "pricing", "plan", "plans", "trial", "subscription", "premium", "paid"];
    const substrings = ["bảng giá", "gói cước", "dùng thử", "定价", "价格", "套餐", "试用", "订阅", "付费"];
    for (const l of LOCALES) {
      for (const [k, v] of Object.entries(load(l))) {
        const text = String(v).toLowerCase();
        for (const w of words) expect(new RegExp(`\\b${w}\\b`).test(text), `${l} ${k} ${w}`).toBe(false);
        for (const s of substrings) expect(text.includes(s), `${l} ${k} ${s}`).toBe(false);
      }
    }
  });
});
