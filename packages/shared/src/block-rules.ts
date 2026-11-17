import type { Category } from "./categories";

export type BlockRule = { kind: "domain" | "category"; value: string };

// Stub: implemented by the developer (add-site-blocking-rules).
export function expandBlockRules(_rules: readonly BlockRule[], _overrides?: Readonly<Record<string, Category>>): string[] {
  throw new Error("not implemented");
}
