import type { Category } from "./categories";
import { categoryDomains } from "./category-domains";

export type BlockRule = { kind: "domain" | "category"; value: string };

export function expandBlockRules(rules: readonly BlockRule[], overrides?: Readonly<Record<string, Category>>): string[] {
  const categories = rules.filter((r) => r.kind === "category").map((r) => r.value as Category);
  const result = new Set<string>(rules.filter((r) => r.kind === "domain").map((r) => r.value));
  for (const d of categoryDomains({ categories, overrides, limit: Number.MAX_SAFE_INTEGER }).domains) result.add(d);
  return [...result].sort();
}
