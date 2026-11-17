import { categorize, SEED_CATEGORIES, type Category } from "./categories";

export type BlockRule = { kind: "domain" | "category"; value: string };

export function expandBlockRules(rules: readonly BlockRule[], overrides?: Readonly<Record<string, Category>>): string[] {
  const blocked = new Set<string>(rules.filter((r) => r.kind === "category").map((r) => r.value));
  const result = new Set<string>(rules.filter((r) => r.kind === "domain").map((r) => r.value));
  if (blocked.size > 0) {
    for (const host of new Set([...Object.keys(SEED_CATEGORIES), ...Object.keys(overrides ?? {})])) {
      if (blocked.has(categorize(host, overrides))) result.add(host);
    }
  }
  return [...result].sort();
}
